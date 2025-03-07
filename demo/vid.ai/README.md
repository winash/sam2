# Vid.AI - Intelligent Video Editing with SAM2 and LLMs

Vid.AI is a demonstration project that showcases the capabilities of the Segment Anything 2 (SAM2) model combined with Large Language Models (LLMs) for intelligent video editing through natural language interface.

## Features

- **Video Upload and Gallery**: Upload your own videos or use the provided examples
- **Object Segmentation**: Click on objects to identify them or describe them via natural language
- **Object Tracking**: Automatically track objects through video frames
- **Effect Application**: Apply different effects like highlight, blur, or color change to objects
- **LLM Integration**: Use natural language to control the video editing process

## Technology Stack

- **Frontend**: Vue.js 3 with TypeScript, Vite, Tailwind CSS, and DaisyUI
- **Backend**: Flask API server with SAM2 integration
- **AI Models**: Segment Anything 2 for video segmentation and OpenAI/Google Gemini for natural language processing

## Prerequisites

- Docker and Docker Compose (for containerized setup)
- Node.js 16+ and npm (for local frontend development)
- Python 3.9+ (for local backend development)
- Segment Anything 2 model and dependencies
- (Optional) OpenAI API key or Google Gemini API key for LLM features

## Installation and Setup

### Using Docker Compose (Recommended)

1. Clone the repository:
   ```bash
   git clone https://github.com/facebookresearch/segment-anything-2.git
   cd segment-anything-2/demo/vid.ai
   ```

2. Create a `.env` file in the project root with your API keys (optional):
   ```
   OPENAI_API_KEY=your_openai_api_key
   GEMINI_API_KEY=your_gemini_api_key
   ```

3. Start the application:
   ```bash
   docker-compose up -d
   ```

4. Access the application at http://localhost:3000

### Manual Setup

#### Backend

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Set environment variables:
   ```bash
   export OPENAI_API_KEY=your_openai_api_key  # Optional
   export GEMINI_API_KEY=your_gemini_api_key  # Optional
   export MODEL_SIZE=base_plus  # or tiny, small, large
   ```

5. Start the backend server:
   ```bash
   python app.py --host 0.0.0.0 --port 5000 --debug
   ```

#### Frontend

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Access the application at http://localhost:5173

## Usage

1. **Upload or Select a Video**: Choose from the gallery or upload your own video file (MP4, AVI, MOV formats supported)

2. **Identify Objects**: 
   - Click the "Add Points" button and then click on the objects you want to track
   - Or, use natural language to describe the objects via the chat interface

3. **Track Objects**: Click "Track Objects" to propagate segmentation through the video

4. **Apply Effects**:
   - Use the chat interface to describe the effects you want to apply
   - Example: "Highlight the person in blue and blur the background"

## Known Limitations

- Maximum video size: 100MB
- Maximum video duration: 60 seconds (recommended)
- LLM features require API keys to be set
- Only base effects are implemented (highlight, blur, outline, color change)

## Credits

- Segment Anything 2 model by Meta AI Research
- Original SAM2 demo code from Meta

## License

This project is licensed under the same license as Segment Anything 2 (MIT License).