# Copyright (c) Meta Platforms, Inc. and affiliates.
# All rights reserved.
# This source code is licensed under the license found in the
# LICENSE file in the root directory of this source tree.

import logging
import json
import os
import numpy as np
from typing import Dict, List, Any, Optional, Tuple

from app_conf import LLM_PROVIDER, OPENAI_API_KEY, GEMINI_API_KEY

logger = logging.getLogger(__name__)

class LLMService:
    """
    Service for handling LLM interactions with different providers
    """
    
    def __init__(self):
        self.provider = LLM_PROVIDER
        logger.info(f"LLM Service initialized with provider: {self.provider}")
        
        if self.provider == "openai" and not OPENAI_API_KEY:
            logger.warning("OpenAI API key not provided. LLM functionality will be limited.")
            
        if self.provider == "gemini" and not GEMINI_API_KEY:
            logger.warning("Gemini API key not provided. LLM functionality will be limited.")
            
        self._init_client()
    
    def _init_client(self):
        """Initialize the appropriate LLM client based on provider"""
        if self.provider == "openai":
            try:
                import openai
                self.client = openai.OpenAI(api_key=OPENAI_API_KEY)
                logger.info("OpenAI client initialized successfully")
            except ImportError:
                logger.error("openai package not installed. Please install with pip install openai")
                self.client = None
            except Exception as e:
                logger.error(f"Error initializing OpenAI client: {str(e)}")
                self.client = None
                
        elif self.provider == "gemini":
            try:
                import google.generativeai as genai
                genai.configure(api_key=GEMINI_API_KEY)
                self.client = genai
                logger.info("Gemini client initialized successfully")
            except ImportError:
                logger.error("google-generativeai package not installed. Please install with pip install google-generativeai")
                self.client = None
            except Exception as e:
                logger.error(f"Error initializing Gemini client: {str(e)}")
                self.client = None
        else:
            logger.error(f"Unsupported LLM provider: {self.provider}")
            self.client = None
    
    def parse_object_description(self, text_prompt: str) -> Dict[str, Any]:
        """
        Parse a text prompt into structured data to guide the segmentation and replacement process
        
        Example prompts:
        - "replace the red ball with a watermelon"
        - "replace the person's head with a cartoon face"
        
        Returns:
        {
            "action": "replace",
            "target": {
                "description": "red ball",
                "attributes": ["red", "round"]
            },
            "replacement": "watermelon",
            "instructions": "The red ball should be replaced with a watermelon of similar size."
        }
        """
        
        # If no client is available, provide basic parsing
        if self.client is None:
            # Simple parsing logic for basic replace/find commands
            text = text_prompt.lower()
            
            if "replace" in text and "with" in text:
                parts = text.split("replace", 1)[1].split("with", 1)
                target = parts[0].strip()
                replacement = parts[1].strip()
                
                return {
                    "action": "replace",
                    "target": {
                        "description": target,
                        "attributes": []
                    },
                    "replacement": replacement,
                    "instructions": f"Replace {target} with {replacement}."
                }
            else:
                # Fallback to handle the text as a target description
                return {
                    "action": "find",
                    "target": {
                        "description": text_prompt,
                        "attributes": []
                    },
                    "replacement": None,
                    "instructions": f"Find and segment {text_prompt}."
                }
        
        # Use LLM for more sophisticated parsing
        if self.provider == "openai":
            return self._parse_with_openai(text_prompt)
        elif self.provider == "gemini":
            return self._parse_with_gemini(text_prompt)
        else:
            logger.error(f"Unsupported LLM provider: {self.provider}")
            return {
                "action": "find",
                "target": {"description": text_prompt, "attributes": []},
                "replacement": None,
                "instructions": "Failed to parse instruction."
            }
    
    def _parse_with_openai(self, text_prompt: str) -> Dict[str, Any]:
        """Parse text prompt using OpenAI"""
        try:
            system_prompt = """
            You are an AI assistant helping to parse user requests for video object segmentation and replacement.
            Extract structured information from the user's request in JSON format with the following fields:
            - action: 'replace' or 'find' based on whether the user wants to replace an object or just find it
            - target: an object with 'description' (what to find/replace) and 'attributes' (list of visual attributes)
            - replacement: what to replace the target with (null if action is 'find')
            - instructions: clear instructions for the image processing system
            """
            
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo-0125",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": text_prompt}
                ],
                response_format={"type": "json_object"}
            )
            
            parsed_response = json.loads(response.choices[0].message.content)
            logger.info(f"OpenAI parsing: {parsed_response}")
            return parsed_response
            
        except Exception as e:
            logger.error(f"Error with OpenAI parsing: {str(e)}")
            # Fallback to basic parsing
            return {
                "action": "find",
                "target": {"description": text_prompt, "attributes": []},
                "replacement": None,
                "instructions": f"Find {text_prompt}."
            }
    
    def _parse_with_gemini(self, text_prompt: str) -> Dict[str, Any]:
        """Parse text prompt using Google Gemini"""
        try:
            system_prompt = """
            You are an AI assistant helping to parse user requests for video object segmentation and replacement.
            Extract structured information from the user's request in JSON format with the following fields:
            - action: 'replace' or 'find' based on whether the user wants to replace an object or just find it
            - target: an object with 'description' (what to find/replace) and 'attributes' (list of visual attributes)
            - replacement: what to replace the target with (null if action is 'find')
            - instructions: clear instructions for the image processing system
            
            Return only valid JSON without any explanation.
            """
            
            model = self.client.GenerativeModel('gemini-pro')
            response = model.generate_content(system_prompt + "\n\nUser request: " + text_prompt)
            
            # Extract JSON from the response
            content = response.text
            # Find JSON content between ```json and ``` if present
            if "```json" in content:
                json_str = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                json_str = content.split("```")[1].strip()
            else:
                json_str = content.strip()
                
            parsed_response = json.loads(json_str)
            logger.info(f"Gemini parsing: {parsed_response}")
            return parsed_response
            
        except Exception as e:
            logger.error(f"Error with Gemini parsing: {str(e)}")
            # Fallback to basic parsing
            return {
                "action": "find",
                "target": {"description": text_prompt, "attributes": []},
                "replacement": None,
                "instructions": f"Find {text_prompt}."
            }