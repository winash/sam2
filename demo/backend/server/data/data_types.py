# Copyright (c) Meta Platforms, Inc. and affiliates.
# All rights reserved.
# This source code is licensed under the license found in the
# LICENSE file in the root directory of this source tree.

from dataclasses import dataclass
from typing import Iterable, List, Optional, Dict, Any

import strawberry
from app_conf import API_URL
from data.resolver import resolve_videos
from dataclasses_json import dataclass_json
from strawberry import relay


@strawberry.type
class Video(relay.Node):
    """Core type for video."""

    code: relay.NodeID[str]
    path: str
    poster_path: Optional[str]
    width: int
    height: int

    @strawberry.field
    def url(self) -> str:
        return f"{API_URL}/{self.path}"

    @strawberry.field
    def poster_url(self) -> str:
        return f"{API_URL}/{self.poster_path}"

    @classmethod
    def resolve_nodes(
        cls,
        *,
        info: relay.PageInfo,
        node_ids: Iterable[str],
        required: bool = False,
    ):
        return resolve_videos(node_ids, required)


@strawberry.type
class RLEMask:
    """Core type for Onevision GraphQL RLE mask."""

    size: List[int]
    counts: str
    order: str


@strawberry.type
class RLEMaskForObject:
    """Type for RLE mask associated with a specific object id."""

    object_id: int
    rle_mask: RLEMask


@strawberry.type
class RLEMaskListOnFrame:
    """Type for a list of object-associated RLE masks on a specific video frame."""

    frame_index: int
    rle_mask_list: List[RLEMaskForObject]


@strawberry.input
class StartSessionInput:
    path: str


@strawberry.type
class StartSession:
    session_id: str


@strawberry.input
class PingInput:
    session_id: str


@strawberry.type
class Pong:
    success: bool


@strawberry.input
class CloseSessionInput:
    session_id: str


@strawberry.type
class CloseSession:
    success: bool


@strawberry.input
class AddPointsInput:
    session_id: str
    frame_index: int
    clear_old_points: bool
    object_id: int
    labels: List[int]
    points: List[List[float]]


@strawberry.input
class ClearPointsInFrameInput:
    session_id: str
    frame_index: int
    object_id: int


@strawberry.input
class ClearPointsInVideoInput:
    session_id: str


@strawberry.type
class ClearPointsInVideo:
    success: bool


@strawberry.input
class RemoveObjectInput:
    session_id: str
    object_id: int


@strawberry.input
class PropagateInVideoInput:
    session_id: str
    start_frame_index: int


@strawberry.input
class CancelPropagateInVideoInput:
    session_id: str


@strawberry.type
class CancelPropagateInVideo:
    success: bool


@strawberry.type
class SessionExpiration:
    session_id: str
    expiration_time: int
    max_expiration_time: int
    ttl: int


# New types for LLM and image replacement functionality

@strawberry.type
class ReplacementImage:
    """Type for replacement images that can be used to replace objects in video."""
    id: str
    path: str
    width: int
    height: int
    
    @strawberry.field
    def url(self) -> str:
        return f"{API_URL}/{self.path}"


@strawberry.type
class ProcessTextPromptResult:
    """Result of processing a text prompt through the LLM."""
    success: bool
    message: str
    frame_index: Optional[int] = None
    rle_mask_list: Optional[List[RLEMaskForObject]] = None
    object_id: Optional[int] = None
    action: Optional[str] = None
    target_description: Optional[str] = None
    replacement: Optional[str] = None


@strawberry.input
class ProcessTextPromptInput:
    """Input for processing a text prompt through the LLM."""
    session_id: str
    frame_index: int
    text_prompt: str


@strawberry.input
class UploadReplacementImageInput:
    """Input for uploading a replacement image."""
    name: str = ""


@strawberry.type
class UploadReplacementImageResult:
    """Result of uploading a replacement image."""
    success: bool
    image_id: Optional[str] = None
    path: Optional[str] = None
    message: str = ""


@strawberry.input
class SetReplacementImageInput:
    """Input for setting a replacement image for an object."""
    session_id: str
    object_id: int
    image_id: str


@strawberry.type
class ReplacementImageList:
    """List of available replacement images."""
    images: List[ReplacementImage]
