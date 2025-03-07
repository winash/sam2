# Copyright (c) Meta Platforms, Inc. and affiliates.
# All rights reserved.
# This source code is licensed under the license found in the
# LICENSE file in the root directory of this source tree.

import hashlib
import logging
import os
import shutil
import uuid
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from PIL import Image

from app_conf import REPLACEMENT_IMAGES_PATH, REPLACEMENT_IMAGES_PREFIX

logger = logging.getLogger(__name__)

class ReplacementImageService:
    """Service for managing replacement images."""
    
    def __init__(self):
        self.images: Dict[str, Dict] = {}
        self._load_existing_images()
        
    def _load_existing_images(self):
        """Load existing replacement images from the filesystem."""
        if not os.path.exists(REPLACEMENT_IMAGES_PATH):
            return
            
        for file_path in REPLACEMENT_IMAGES_PATH.glob("*.png"):
            try:
                image_id = file_path.stem
                img = Image.open(file_path)
                
                self.images[image_id] = {
                    "id": image_id,
                    "path": f"{REPLACEMENT_IMAGES_PREFIX}/{file_path.name}",
                    "width": img.width,
                    "height": img.height
                }
            except Exception as e:
                logger.error(f"Error loading replacement image {file_path}: {str(e)}")
    
    def get_all_images(self) -> List[Dict]:
        """Get all available replacement images."""
        return list(self.images.values())
    
    def get_image(self, image_id: str) -> Optional[Dict]:
        """Get a specific replacement image by ID."""
        return self.images.get(image_id)
    
    def save_image(self, image_data: bytes, name: str = "") -> Tuple[bool, str, Optional[Dict]]:
        """
        Save a new replacement image.
        
        Args:
            image_data: The binary image data
            name: Optional display name for the image
            
        Returns:
            (success, message, image_data)
        """
        try:
            # Generate a unique ID for the image
            image_id = str(uuid.uuid4())
            
            # Create the file path
            file_name = f"{image_id}.png"
            file_path = REPLACEMENT_IMAGES_PATH / file_name
            
            # Save the image
            with open(file_path, "wb") as f:
                f.write(image_data)
            
            # Get image dimensions
            img = Image.open(file_path)
            width, height = img.size
            
            # Store image metadata
            image_info = {
                "id": image_id,
                "path": f"{REPLACEMENT_IMAGES_PREFIX}/{file_name}",
                "width": width,
                "height": height
            }
            self.images[image_id] = image_info
            
            return True, "Image uploaded successfully", image_info
            
        except Exception as e:
            logger.error(f"Error saving replacement image: {str(e)}")
            return False, f"Error saving image: {str(e)}", None
    
    def delete_image(self, image_id: str) -> Tuple[bool, str]:
        """Delete a replacement image."""
        if image_id not in self.images:
            return False, "Image not found"
            
        try:
            # Delete the file
            file_path = REPLACEMENT_IMAGES_PATH / f"{image_id}.png"
            if os.path.exists(file_path):
                os.remove(file_path)
                
            # Remove from dictionary
            del self.images[image_id]
            
            return True, "Image deleted successfully"
            
        except Exception as e:
            logger.error(f"Error deleting replacement image {image_id}: {str(e)}")
            return False, f"Error deleting image: {str(e)}"


# Singleton instance
replacement_image_service = ReplacementImageService()