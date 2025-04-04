# Copyright (c) Meta Platforms, Inc. and affiliates.
# All rights reserved.
# This source code is licensed under the license found in the
# LICENSE file in the root directory of this source tree.

import logging
from typing import Any, Generator

from app_conf import (
    GALLERY_PATH,
    GALLERY_PREFIX,
    POSTERS_PATH,
    POSTERS_PREFIX,
    UPLOADS_PATH,
    UPLOADS_PREFIX,
    REPLACEMENT_IMAGES_PATH,
    REPLACEMENT_IMAGES_PREFIX,
)
from data.loader import preload_data
from data.schema import schema
from data.store import set_videos
from flask import Flask, make_response, Request, request, Response, send_from_directory
from flask_cors import CORS
from inference.data_types import PropagateDataResponse, PropagateInVideoRequest
from inference.multipart import MultipartResponseBuilder
from inference.predictor import InferenceAPI
from strawberry.flask.views import GraphQLView

logger = logging.getLogger(__name__)

app = Flask(__name__)
# When using credentials mode with CORS, we need to specify the exact origins
# We can't use '*' with Access-Control-Allow-Credentials: true
cors = CORS(
    app, 
    supports_credentials=True,
    resources={r"/*": {
        "origins": ["http://localhost:7262", "http://127.0.0.1:7262"], 
        "allow_headers": "*", 
        "expose_headers": "*"
    }}
)

videos = preload_data()
set_videos(videos)

inference_api = InferenceAPI()


@app.route("/healthy")
def healthy() -> Response:
    response = make_response("OK", 200)
    origin = request.headers.get('Origin', 'http://localhost:7262')
    response.headers['Access-Control-Allow-Origin'] = origin
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    return response


@app.route(f"/{GALLERY_PREFIX}/<path:path>", methods=["GET"])
def send_gallery_video(path: str) -> Response:
    try:
        response = send_from_directory(
            GALLERY_PATH,
            path,
        )
        # Using specific origin instead of '*' to allow credentials
        origin = request.headers.get('Origin', 'http://localhost:7262')
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        return response
    except:
        raise ValueError("resource not found")


@app.route(f"/{POSTERS_PREFIX}/<path:path>", methods=["GET"])
def send_poster_image(path: str) -> Response:
    try:
        response = send_from_directory(
            POSTERS_PATH,
            path,
        )
        origin = request.headers.get('Origin', 'http://localhost:7262')
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        return response
    except:
        raise ValueError("resource not found")


@app.route(f"/{UPLOADS_PREFIX}/<path:path>", methods=["GET"])
def send_uploaded_video(path: str):
    try:
        response = send_from_directory(
            UPLOADS_PATH,
            path,
        )
        origin = request.headers.get('Origin', 'http://localhost:7262')
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        return response
    except:
        raise ValueError("resource not found")


@app.route(f"/{REPLACEMENT_IMAGES_PREFIX}/<path:path>", methods=["GET"])
def send_replacement_image(path: str):
    try:
        response = send_from_directory(
            REPLACEMENT_IMAGES_PATH,
            path,
        )
        origin = request.headers.get('Origin', 'http://localhost:7262')
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        return response
    except:
        raise ValueError("resource not found")


# TOOD: Protect route with ToS permission check
@app.route("/propagate_in_video", methods=["POST", "OPTIONS"])
def propagate_in_video() -> Response:
    origin = request.headers.get('Origin', 'http://localhost:7262')
    
    if request.method == "OPTIONS":
        response = Response()
        response.headers.add('Access-Control-Allow-Origin', origin)
        response.headers.add('Access-Control-Allow-Headers', '*')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response
        
    data = request.json
    args = {
        "session_id": data["session_id"],
        "start_frame_index": data.get("start_frame_index", 0),
    }

    boundary = "frame"
    frame = gen_track_with_mask_stream(boundary, **args)
    response = Response(frame, mimetype="multipart/x-savi-stream; boundary=" + boundary)
    response.headers['Access-Control-Allow-Origin'] = origin
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    return response


def gen_track_with_mask_stream(
    boundary: str,
    session_id: str,
    start_frame_index: int,
) -> Generator[bytes, None, None]:
    with inference_api.autocast_context():
        request = PropagateInVideoRequest(
            type="propagate_in_video",
            session_id=session_id,
            start_frame_index=start_frame_index,
        )

        for chunk in inference_api.propagate_in_video(request=request):
            yield MultipartResponseBuilder.build(
                boundary=boundary,
                headers={
                    "Content-Type": "application/json; charset=utf-8",
                    "Frame-Current": "-1",
                    # Total frames minus the reference frame
                    "Frame-Total": "-1",
                    "Mask-Type": "RLE[]",
                },
                body=chunk.to_json().encode("UTF-8"),
            ).get_message()


class MyGraphQLView(GraphQLView):
    def get_context(self, request: Request, response: Response) -> Any:
        # Add CORS headers to all GraphQL responses
        origin = request.headers.get('Origin', 'http://localhost:7262')
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Headers'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        return {"inference_api": inference_api}


# Add a route handler specifically for OPTIONS requests to /graphql
@app.route("/graphql", methods=["OPTIONS"])
def graphql_options():
    origin = request.headers.get('Origin', 'http://localhost:7262')
    response = Response()
    response.headers.add('Access-Control-Allow-Origin', origin)
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response

# Add GraphQL route to Flask app.
app.add_url_rule(
    "/graphql",
    view_func=MyGraphQLView.as_view(
        "graphql_view",
        schema=schema,
        # Disable GET queries
        # https://strawberry.rocks/docs/operations/deployment
        # https://strawberry.rocks/docs/integrations/flask
        allow_queries_via_get=False,
        # Strawberry recently changed multipart request handling, which now
        # requires enabling support explicitly for views.
        # https://github.com/strawberry-graphql/strawberry/issues/3655
        multipart_uploads_enabled=True,
    ),
)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
