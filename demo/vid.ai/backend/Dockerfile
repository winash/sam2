FROM python:3.9-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libgl1-mesa-glx \
    libglib2.0-0 \
    wget \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy SAM2 source code
COPY . /app/backend/
WORKDIR /app

# Clone the SAM2 repository (in a real deployment, you'd volume mount the SAM2 code)
RUN git clone https://github.com/facebookresearch/segment-anything-2.git /app/segment-anything-2

# Set environment variables
ENV PYTHONPATH=/app:/app/segment-anything-2
ENV MODEL_SIZE=base_plus

# Create directories for data
RUN mkdir -p /app/data/gallery /app/data/uploads

# Copy the gallery videos if available
COPY ./data/gallery/* /app/data/gallery/

# Expose the port
EXPOSE 5000

# Run the server
CMD ["python", "/app/backend/app.py", "--host", "0.0.0.0", "--port", "5000"]