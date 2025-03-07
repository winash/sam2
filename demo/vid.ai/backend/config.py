#!/usr/bin/env python3
# Copyright (c) Meta Platforms, Inc. and affiliates.
# All rights reserved.

# This source code is licensed under the license found in the
# LICENSE file in the root directory of this source tree.

import os
from typing import Dict, Any

class AppConfig:
    """Configuration for the SAM2 Video API Server."""
    
    def __init__(self):
        # Base paths
        self.base_dir = os.path.dirname(os.path.abspath(__file__))
        self.data_dir = os.path.abspath(os.path.join(self.base_dir, "../data"))
        
        # Paths for videos
        self.gallery_path = os.path.join(self.data_dir, "gallery")
        self.upload_path = os.path.join(self.data_dir, "uploads")
        os.makedirs(self.upload_path, exist_ok=True)
        
        # Model configuration
        self.model_config = {
            "model_size": os.environ.get("MODEL_SIZE", "base_plus"),
            "max_video_duration": 60,  # Maximum video duration in seconds
            "max_upload_size": 100 * 1024 * 1024  # 100 MB
        }
        
        # LLM configuration
        self.llm_config = {
            "openai": {
                "api_key": os.environ.get("OPENAI_API_KEY", ""),
                "model": "gpt-4"
            },
            "gemini": {
                "api_key": os.environ.get("GEMINI_API_KEY", ""),
                "model": "gemini-pro"
            }
        }
        
        # Effects available for objects
        self.available_effects = [
            {
                "id": "highlight",
                "name": "Highlight",
                "description": "Highlight the object with a color overlay"
            },
            {
                "id": "blur",
                "name": "Blur",
                "description": "Apply a blur effect to the object"
            },
            {
                "id": "remove",
                "name": "Remove",
                "description": "Attempt to remove the object from the scene"
            },
            {
                "id": "color_change",
                "name": "Change Color",
                "description": "Change the color of the object"
            },
            {
                "id": "outline",
                "name": "Outline",
                "description": "Draw an outline around the object"
            }
        ]
        
        # Web server configuration
        self.server_config = {
            "host": "0.0.0.0",
            "port": 5000,
            "debug": False
        }