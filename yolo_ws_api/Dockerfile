FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libgstreamer1.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create models directory - GANTI NAMA
RUN mkdir -p yolo_models

# Expose port
EXPOSE 8000

# Environment variables
ENV WS_HOST=0.0.0.0
ENV WS_PORT=8000
ENV IMG_WIDTH=640
ENV IMG_HEIGHT=640
ENV FPS=30
ENV QUALITY=80

# Run application
CMD ["python", "main.py"]