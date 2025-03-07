#!/usr/bin/env python3
# Copyright (c) Meta Platforms, Inc. and affiliates.
# All rights reserved.

# This source code is licensed under the license found in the
# LICENSE file in the root directory of this source tree.

import argparse
import json
import os
import sys
from typing import Any, Dict, List, Optional, Tuple, Union

import flask
import numpy as np
import torch
from flask import Flask, Response, jsonify, request
from flask_cors import CORS

# Add the sam2 module to the path
current_dir = os.path.dirname(os.path.abspath(__file__))
sam2_dir = os.path.abspath(os.path.join(current_dir, "../../../"))
sys.path.append(sam2_dir)

from sam2.build_sam import build_sam2_video_predictor
from sam2.utils.amg import generate_masks

import requests
from config import AppConfig

# Initialize Flask app
app = Flask(__name__)
CORS(app)
config = AppConfig()

# LLM API clients
LLM_PROVIDERS = {
    "openai": None,
    "gemini": None
}

def get_device():
    """Get the appropriate device for running the model."""
    if torch.cuda.is_available():
        device = torch.device("cuda:0")
        # For Ampere GPUs, enable TF32 for better performance
        if torch.cuda.get_device_capability()[0] >= 8:
            torch.backends.cuda.matmul.allow_tf32 = True
            torch.backends.cudnn.allow_tf32 = True
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        device = torch.device("mps")
    else:
        device = torch.device("cpu")
    return device

class InferenceAPI:
    """API for the SAM2 model inference."""
    
    def __init__(self):
        self.device = get_device()
        self.model_size = os.environ.get("MODEL_SIZE", "base_plus").lower()
        self.video_model = None
        self.inference_lock = None  # Initialize if needed for thread safety
        self.sessions = {}
        self.load_model()
        
    def load_model(self):
        """Load the SAM2 model."""
        print(f"Loading SAM2 model (size: {self.model_size}) on {self.device}...")
        
        # Initialize model with the specified size
        self.video_model = build_sam2_video_predictor(
            model_type=self.model_size,
            device=self.device,
            offload_state_to_cpu=(self.device.type == "mps"),
            use_vos_compiled=True  # Use the optimized version
        )
        print("Model loaded successfully")
    
    def start_session(self, video_path: str) -> str:
        """Start a new session for video processing."""
        import uuid
        session_id = str(uuid.uuid4())
        self.sessions[session_id] = {
            "video_path": video_path,
            "frames": None,
            "points": [],
            "object_ids": [],
            "masks": None
        }
        # Load the video frames
        self._load_frames(session_id)
        return session_id
    
    def _load_frames(self, session_id):
        """Load video frames for the given session."""
        import cv2
        
        video_path = self.sessions[session_id]["video_path"]
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video file not found: {video_path}")
        
        cap = cv2.VideoCapture(video_path)
        frames = []
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            frames.append(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        
        cap.release()
        self.sessions[session_id]["frames"] = frames
    
    def add_points(self, session_id: str, frame_idx: int, points: List[Tuple[int, int]], labels: List[int]) -> Dict:
        """Add points to a frame in the session."""
        if session_id not in self.sessions:
            raise ValueError(f"Invalid session ID: {session_id}")
        
        session = self.sessions[session_id]
        frames = session["frames"]
        
        if frame_idx < 0 or frame_idx >= len(frames):
            raise ValueError(f"Invalid frame index: {frame_idx}")
        
        # Store the points
        session["points"].append({
            "frame_idx": frame_idx,
            "points": points,
            "labels": labels
        })
        
        # Generate mask for current frame
        frame = frames[frame_idx]
        point_coords = np.array(points)
        point_labels = np.array(labels)
        
        masks, scores, logits = generate_masks(
            self.video_model,
            frame,
            point_coords,
            point_labels,
            multimask_output=True
        )
        
        # Convert masks to RLE format
        from pycocotools import mask as mask_utils
        mask_data = []
        
        for i, (mask, score) in enumerate(zip(masks, scores)):
            if score >= 0.5:  # Threshold for mask quality
                rle = mask_utils.encode(np.asfortranarray(mask.astype(np.uint8)))
                rle["counts"] = rle["counts"].decode("utf-8")
                mask_data.append({
                    "rle": rle,
                    "score": float(score),
                    "id": i
                })
        
        return {
            "masks": mask_data,
            "frame_idx": frame_idx
        }
    
    def propagate_in_video(self, session_id: str, frame_idx: int) -> Dict:
        """Propagate mask from a starting frame to the entire video."""
        if session_id not in self.sessions:
            raise ValueError(f"Invalid session ID: {session_id}")
        
        session = self.sessions[session_id]
        frames = session["frames"]
        
        if frame_idx < 0 or frame_idx >= len(frames):
            raise ValueError(f"Invalid frame index: {frame_idx}")
        
        # Find the points for the given frame
        point_data = None
        for points in session["points"]:
            if points["frame_idx"] == frame_idx:
                point_data = points
                break
        
        if point_data is None:
            raise ValueError(f"No points found for frame {frame_idx}")
        
        # Extract points and labels
        point_coords = np.array(point_data["points"])
        point_labels = np.array(point_data["labels"])
        
        # Reset model's internal state to start from this frame
        self.video_model.reset_state()
        
        # Generate mask for starting frame
        frame = frames[frame_idx]
        masks, scores, logits = generate_masks(
            self.video_model,
            frame,
            point_coords,
            point_labels,
            multimask_output=True
        )
        
        # Find best mask based on score
        best_mask_idx = np.argmax(scores)
        mask = masks[best_mask_idx]
        
        # Initialize the video model with the starting frame
        self.video_model.set_image(frame)
        self.video_model.add_track(mask, obj_id=0)
        
        # Propagate forward
        all_frame_masks = {}
        all_frame_masks[frame_idx] = [self._encode_mask(mask, 0)]
        
        # Forward propagation (from start frame to end)
        for idx in range(frame_idx + 1, len(frames)):
            curr_frame = frames[idx]
            self.video_model.track_next(curr_frame)
            obj_mask = self.video_model.get_obj_mask(obj_id=0)
            all_frame_masks[idx] = [self._encode_mask(obj_mask, 0)]
        
        # Reset and propagate backward if needed
        self.video_model.reset_state()
        self.video_model.set_image(frame)
        self.video_model.add_track(mask, obj_id=0)
        
        # Backward propagation (from start frame to beginning)
        for idx in range(frame_idx - 1, -1, -1):
            curr_frame = frames[idx]
            self.video_model.track_prev(curr_frame)
            obj_mask = self.video_model.get_obj_mask(obj_id=0)
            all_frame_masks[idx] = [self._encode_mask(obj_mask, 0)]
        
        return all_frame_masks
    
    def _encode_mask(self, mask, obj_id=0):
        """Encode a binary mask to RLE format."""
        from pycocotools import mask as mask_utils
        
        mask_arr = mask.astype(np.uint8)
        rle = mask_utils.encode(np.asfortranarray(mask_arr))
        rle["counts"] = rle["counts"].decode("utf-8")
        
        return {
            "rle": rle,
            "object_id": obj_id,
            "score": 1.0  # For tracked masks, we assign a high confidence
        }
    
    def end_session(self, session_id: str) -> bool:
        """End a session and clean up resources."""
        if session_id in self.sessions:
            del self.sessions[session_id]
            return True
        return False

class LLMInterface:
    """Interface for LLM API calls."""
    
    def __init__(self, provider="openai"):
        self.provider = provider
        self.config = config.llm_config.get(provider, {})
        self.api_key = self.config.get("api_key", "")
        
    def process_prompt(self, prompt, video_context=None):
        """Process a prompt with the selected LLM provider."""
        if self.provider == "openai":
            return self._call_openai(prompt, video_context)
        elif self.provider == "gemini":
            return self._call_gemini(prompt, video_context)
        else:
            raise ValueError(f"Unsupported LLM provider: {self.provider}")
    
    def _call_openai(self, prompt, video_context=None):
        """Call OpenAI API with the user prompt."""
        import openai
        
        if not self.api_key:
            return {"error": "OpenAI API key not configured"}
        
        openai.api_key = self.api_key
        
        # Build the message content
        system_message = """You are an assistant that helps users edit videos using the Segment Anything 2 model.
        You can identify objects in videos and apply effects to them.
        When a user asks to modify a video, provide clear instructions about:
        1. Which objects to identify (person, dog, car, etc.)
        2. What effect to apply (highlight, blur, change color, etc.)
        3. If tracking is needed for moving objects
        Respond in JSON format with 'objects' and 'effects' fields."""
        
        messages = [
            {"role": "system", "content": system_message},
            {"role": "user", "content": prompt}
        ]
        
        # Add video context if available
        if video_context:
            messages.insert(1, {"role": "system", "content": f"Video context: {video_context}"})
        
        try:
            response = openai.ChatCompletion.create(
                model="gpt-4",  # or other appropriate model
                messages=messages,
                response_format={"type": "json_object"}
            )
            
            return {
                "response": response.choices[0].message.content,
                "provider": "openai"
            }
        except Exception as e:
            return {"error": str(e)}
    
    def _call_gemini(self, prompt, video_context=None):
        """Call Google Gemini API with the user prompt."""
        import google.generativeai as genai
        
        if not self.api_key:
            return {"error": "Gemini API key not configured"}
        
        genai.configure(api_key=self.api_key)
        
        # Build the message content
        system_prompt = """You are an assistant that helps users edit videos using the Segment Anything 2 model.
        You can identify objects in videos and apply effects to them.
        When a user asks to modify a video, provide clear instructions about:
        1. Which objects to identify (person, dog, car, etc.)
        2. What effect to apply (highlight, blur, change color, etc.)
        3. If tracking is needed for moving objects
        Respond in JSON format with 'objects' and 'effects' fields."""
        
        full_prompt = system_prompt
        
        # Add video context if available
        if video_context:
            full_prompt += f"\nVideo context: {video_context}\n"
        
        full_prompt += f"\nUser request: {prompt}\nGenerate JSON response:"
        
        try:
            model = genai.GenerativeModel('gemini-pro')
            response = model.generate_content(full_prompt)
            
            # Extract JSON from response
            response_text = response.text
            # Find JSON in the response (might be surrounded by markdown code blocks)
            import re
            json_match = re.search(r'```json\n(.*?)\n```', response_text, re.DOTALL)
            if json_match:
                response_text = json_match.group(1)
            
            try:
                # Validate JSON
                parsed = json.loads(response_text)
                return {
                    "response": response_text,
                    "provider": "gemini"
                }
            except json.JSONDecodeError:
                return {
                    "error": "Failed to parse JSON from Gemini response",
                    "raw_response": response_text
                }
            
        except Exception as e:
            return {"error": str(e)}

# Initialize API
inference_api = InferenceAPI()
llm_interface = None  # Will be initialized on first use

# API Endpoints
@app.route("/api/health", methods=["GET"])
def health_check():
    """Health check endpoint."""
    return jsonify({"status": "healthy"})

@app.route("/api/videos/gallery", methods=["GET"])
def list_gallery_videos():
    """List all available videos in the gallery."""
    gallery_path = config.gallery_path
    videos = []
    
    for filename in os.listdir(gallery_path):
        if filename.endswith((".mp4", ".avi", ".mov")):
            videos.append({
                "id": filename,
                "name": os.path.splitext(filename)[0],
                "path": f"/api/videos/gallery/{filename}"
            })
    
    return jsonify(videos)

@app.route("/api/videos/gallery/<video_id>", methods=["GET"])
def get_gallery_video(video_id):
    """Get a specific video from the gallery."""
    video_path = os.path.join(config.gallery_path, video_id)
    
    if not os.path.exists(video_path):
        return jsonify({"error": "Video not found"}), 404
    
    return flask.send_file(video_path)

@app.route("/api/videos/upload", methods=["POST"])
def upload_video():
    """Upload a new video."""
    if "video" not in request.files:
        return jsonify({"error": "No video file provided"}), 400
    
    video_file = request.files["video"]
    
    if video_file.filename == "":
        return jsonify({"error": "No video file selected"}), 400
    
    if not video_file.filename.endswith((".mp4", ".avi", ".mov")):
        return jsonify({"error": "Invalid video format"}), 400
    
    filename = os.path.basename(video_file.filename)
    upload_path = os.path.join(config.upload_path, filename)
    
    video_file.save(upload_path)
    
    return jsonify({
        "id": filename,
        "name": os.path.splitext(filename)[0],
        "path": f"/api/videos/uploads/{filename}"
    })

@app.route("/api/videos/uploads/<video_id>", methods=["GET"])
def get_uploaded_video(video_id):
    """Get a specific uploaded video."""
    video_path = os.path.join(config.upload_path, video_id)
    
    if not os.path.exists(video_path):
        return jsonify({"error": "Video not found"}), 404
    
    return flask.send_file(video_path)

@app.route("/api/sessions", methods=["POST"])
def create_session():
    """Create a new session for video processing."""
    data = request.json
    
    if not data or "video_path" not in data:
        return jsonify({"error": "Missing video_path parameter"}), 400
    
    video_path = data["video_path"]
    
    # Check if path is relative to gallery or uploads
    if video_path.startswith("/api/videos/gallery/"):
        video_id = os.path.basename(video_path)
        video_path = os.path.join(config.gallery_path, video_id)
    elif video_path.startswith("/api/videos/uploads/"):
        video_id = os.path.basename(video_path)
        video_path = os.path.join(config.upload_path, video_id)
    
    if not os.path.exists(video_path):
        return jsonify({"error": f"Video not found: {video_path}"}), 404
    
    try:
        session_id = inference_api.start_session(video_path)
        return jsonify({"session_id": session_id})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/sessions/<session_id>/points", methods=["POST"])
def add_points(session_id):
    """Add points to a frame in the session."""
    data = request.json
    
    if not data or "frame_idx" not in data or "points" not in data or "labels" not in data:
        return jsonify({"error": "Missing required parameters"}), 400
    
    frame_idx = data["frame_idx"]
    points = data["points"]
    labels = data["labels"]
    
    try:
        result = inference_api.add_points(session_id, frame_idx, points, labels)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/sessions/<session_id>/propagate", methods=["POST"])
def propagate_masks(session_id):
    """Propagate masks from a starting frame to the entire video."""
    data = request.json
    
    if not data or "frame_idx" not in data:
        return jsonify({"error": "Missing frame_idx parameter"}), 400
    
    frame_idx = data["frame_idx"]
    
    try:
        # Use a streaming response to handle large responses
        def generate():
            all_masks = inference_api.propagate_in_video(session_id, frame_idx)
            
            for frame_idx, masks in sorted(all_masks.items()):
                yield json.dumps({
                    "frame_idx": frame_idx,
                    "masks": masks
                }) + "\n"
        
        return Response(generate(), mimetype="application/x-ndjson")
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/sessions/<session_id>", methods=["DELETE"])
def end_session(session_id):
    """End a session and clean up resources."""
    try:
        success = inference_api.end_session(session_id)
        if success:
            return jsonify({"status": "success"})
        else:
            return jsonify({"error": "Session not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/llm/process", methods=["POST"])
def process_llm_prompt():
    """Process a prompt with the LLM."""
    global llm_interface
    
    data = request.json
    
    if not data or "prompt" not in data:
        return jsonify({"error": "Missing prompt parameter"}), 400
    
    prompt = data["prompt"]
    provider = data.get("provider", "openai")
    video_context = data.get("video_context")
    
    # Initialize LLM interface if needed
    if llm_interface is None or llm_interface.provider != provider:
        llm_interface = LLMInterface(provider=provider)
    
    try:
        result = llm_interface.process_prompt(prompt, video_context)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/llm/parse_instructions", methods=["POST"])
def parse_llm_instructions():
    """Parse LLM output and convert to model instructions."""
    data = request.json
    
    if not data or "llm_response" not in data:
        return jsonify({"error": "Missing llm_response parameter"}), 400
    
    llm_response = data["llm_response"]
    
    try:
        # Parse the LLM response (assumed to be JSON)
        if isinstance(llm_response, str):
            instructions = json.loads(llm_response)
        else:
            instructions = llm_response
        
        # Extract objects and effects
        objects = instructions.get("objects", [])
        effects = instructions.get("effects", [])
        
        # Convert to model instructions
        model_instructions = {
            "objects": objects,
            "effects": effects,
            "tracking": instructions.get("tracking", True)
        }
        
        return jsonify(model_instructions)
    except json.JSONDecodeError:
        return jsonify({"error": "Invalid JSON in LLM response"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def main():
    parser = argparse.ArgumentParser(description="SAM2 Video API Server")
    parser.add_argument("--host", type=str, default="0.0.0.0", help="Host to run the server on")
    parser.add_argument("--port", type=int, default=5000, help="Port to run the server on")
    parser.add_argument("--model-size", type=str, default="base_plus", help="Model size (tiny, small, base_plus, large)")
    parser.add_argument("--debug", action="store_true", help="Run in debug mode")
    
    args = parser.parse_args()
    
    # Set model size environment variable
    os.environ["MODEL_SIZE"] = args.model_size
    
    # Make sure the upload directory exists
    os.makedirs(config.upload_path, exist_ok=True)
    
    print(f"Starting SAM2 Video API Server on {args.host}:{args.port}")
    print(f"Model size: {args.model_size}")
    print(f"Gallery path: {config.gallery_path}")
    print(f"Upload path: {config.upload_path}")
    
    app.run(host=args.host, port=args.port, debug=args.debug)

if __name__ == "__main__":
    main()