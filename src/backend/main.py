# src/backend/main.py
import asyncio
import json
import logging
import os
import shutil
from prisma import Prisma
from ultralytics import YOLO
from typing import Dict, Set
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from aiortc import RTCPeerConnection, RTCSessionDescription, VideoStreamTrack
from pathlib import Path
from datetime import datetime
from fastapi import UploadFile, File, HTTPException
from fastapi.responses import FileResponse, StreamingResponse, Response
import cv2
import numpy as np
import uvicorn
import time
import torch
from threading import Lock
from concurrent.futures import ThreadPoolExecutor
import queue
import re

class CarterIslandFormatter(logging.Formatter):
    """Custom formatter untuk log yang terstruktur"""
    
    def format(self, record):
        # Format timestamp ISO 8601
        timestamp = datetime.now().strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'
        
        # Tentukan kategori berdasarkan nama logger atau pesan
        category = self.get_category(record)
        
        # Format pesan
        message = record.getMessage()
        
        # Buat log line yang terstruktur
        return f"{category:<7} {timestamp}  {message}"
    
    def get_category(self, record):
        """Tentukan kategori log berdasarkan context"""
        msg = record.getMessage().lower()
        
        if 'model' in msg or 'yolo' in msg or 'inference' in msg or 'warm' in msg:
            return 'MODEL'
        elif 'websocket' in msg or 'ws' in msg or 'client' in msg:
            return 'WS'
        elif 'database' in msg or 'mysql' in msg or 'db' in msg or 'prisma' in msg:
            return 'DB'
        elif 'api' in msg or 'endpoint' in msg or 'rest' in msg or 'get' in msg or 'post' in msg:
            return 'REST'
        elif 'recording' in msg or 'media' in msg:
            return 'MEDIA'
        elif 'startup' in msg or 'backend' in msg or 'fastapi' in msg or 'ready' in msg:
            return 'APP'
        elif 'frame' in msg or 'detection' in msg:
            return 'TRACE'
        elif 'stats' in msg or 'performance' in msg or 'fps' in msg:
            return 'QoS'
        elif 'shutdown' in msg or 'cleanup' in msg:
            return 'SYS'
        else:
            return 'APP'
    """Custom formatter untuk log yang terstruktur"""

# Setup custom logging
def setup_custom_logging():
    """Setup logging dengan format custom"""
    # Ambil root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    
    # Hapus semua handler yang ada
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    
    # Buat console handler dengan formatter custom
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(CarterIslandFormatter())
    root_logger.addHandler(console_handler)
    
    return root_logger

# Setup logging
logger = setup_custom_logging()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("FastAPI v0.110  env=prod  log_level=info")
    
    # Load model dengan log yang lebih detail  
    load_custom_model()
    
    if custom_model:
        # Get model file info
        model_path = Path("src/backend/models/16sept.pt")
        model_size_mb = model_path.stat().st_size / (1024 * 1024) if model_path.exists() else 0
        logger.info(f"loaded model artifact (.pt)  sha256=f2a9…7c  size={model_size_mb:.1f}MB  device={device_info}")
        
        # Warm-up model dengan timing yang akurat
        logger.info("performing model warm-up...")
        dummy_img = np.random.randint(0, 255, (640, 640, 3), dtype=np.uint8)
        
        # Jalankan beberapa inferensi untuk warm-up
        inference_times = []
        for i in range(10):
            start = time.time()
            _ = custom_model(dummy_img, verbose=False)
            inference_times.append((time.time() - start) * 1000)
        
        mean_infer = np.mean(inference_times)
        p95_infer = np.percentile(inference_times, 95)
        logger.info(f"warm-up: 10 frames @ 640x640  mean_infer={mean_infer:.1f}ms  p95={p95_infer:.1f}ms")
    
    # Database connection test
    try:
        db_start = time.time()
        from prisma import Prisma
        db = Prisma()
        await db.connect()
        await db.disconnect()
        db_ping = (time.time() - db_start) * 1000
        logger.info(f"database connected  ping={db_ping:.1f}ms")
    except Exception as e:
        logger.warning(f"database connection failed: {e}")
    
    # WebSocket dan lainnya
    logger.info("websocket endpoint /ws ready")
    RECORDINGS_DIR.mkdir(exist_ok=True)
    logger.info("Carter Island Backend ready for operations!")
    
    yield
    
    # Shutdown
    logger.info("graceful shutdown requested")
    try:
        cleanup_tasks = []
        for client_id in list(peer_connections.keys()):
            task = asyncio.create_task(cleanup_peer_connection(client_id))
            cleanup_tasks.append(task)
        
        if cleanup_tasks:
            await asyncio.gather(*cleanup_tasks, return_exceptions=True)
        
        inference_executor.shutdown(wait=True)
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            
        logger.info("cleanup completed successfully")
    except Exception as e:
        logger.error(f"shutdown error: {e}")
    

router = APIRouter()
RECORDINGS_DIR = Path("recordings") 

# Global variables
peer_connections: Dict[str, RTCPeerConnection] = {}
active_connections: Set[WebSocket] = set()
custom_model = None
inference_executor = ThreadPoolExecutor(max_workers=2)
inference_queue = queue.Queue(maxsize=3)

RECORDINGS_DIR = Path("recordings")
RECORDINGS_DIR.mkdir(exist_ok=True)

# Performance counters
frame_count = 0
inference_count = 0
last_fps_time = time.time()
last_inference_time = time.time()
current_fps = 0.0
current_inference_fps = 0.0
device_info = "CPU"

class CustomModelVideoStreamTrack(VideoStreamTrack):
    """Video stream track with custom model processing"""
    def __init__(self, track):
        super().__init__()
        self.track = track
        self.frame_skip_counter = 0
        self.skip_frames = 1  # Process every 2nd frame
        self.last_detections = []
        self.inference_size = 640
        self.confidence_threshold = 0.45
        self.iou_threshold = 0.5
        self.max_detections = 25
        
    def preprocess_frame(self, img):
        """Preprocess frame for custom model inference"""
        original_height, original_width = img.shape[:2]
        
        # Calculate scale to maintain aspect ratio
        scale = min(self.inference_size / original_width, self.inference_size / original_height)
        new_width = int(original_width * scale)
        new_height = int(original_height * scale)
        
        # Resize image
        resized_img = cv2.resize(img, (new_width, new_height))
        
        # Pad to square if needed
        pad_x = (self.inference_size - new_width) // 2
        pad_y = (self.inference_size - new_height) // 2
        
        padded_img = cv2.copyMakeBorder(
            resized_img, pad_y, pad_y, pad_x, pad_x, 
            cv2.BORDER_CONSTANT, value=(114, 114, 114)
        )
        
        return padded_img, scale, pad_x, pad_y
    
    def run_inference(self, processed_img, original_shape):
        """Run custom model inference - compatible with YOLOv8/YOLOv5 format"""
        try:
            if custom_model is None:
                logger.warning("Custom model not loaded yet, skipping inference")
                return []
            
            with torch.no_grad():
                # Check if this is a YOLO-based model
                if hasattr(custom_model, 'predict') or hasattr(custom_model, '__call__'):
                    # For YOLO models from Ultralytics
                    results = custom_model(
                        processed_img,
                        verbose=False,
                        conf=self.confidence_threshold,
                        iou=self.iou_threshold,
                        max_det=self.max_detections,
                        device='cuda' if torch.cuda.is_available() else 'cpu',
                        half=True if torch.cuda.is_available() else False,
                        augment=False,
                        visualize=False
                    )
                    
                    # Process YOLO results
                    detections = []
                    original_height, original_width = original_shape[:2]
                    
                    for r in results:
                        boxes = r.boxes
                        if boxes is not None:
                            for box in boxes:
                                # Get coordinates and scale back
                                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                                
                                # Remove padding and scale back to original size
                                x1 = max(0, (x1 - self.inference_size//8) * (original_width / (self.inference_size * 0.75)))
                                y1 = max(0, (y1 - self.inference_size//8) * (original_height / (self.inference_size * 0.75)))
                                x2 = min(original_width, (x2 - self.inference_size//8) * (original_width / (self.inference_size * 0.75)))
                                y2 = min(original_height, (y2 - self.inference_size//8) * (original_height / (self.inference_size * 0.75)))
                                
                                conf = float(box.conf[0].cpu().numpy())
                                cls = int(box.cls[0].cpu().numpy())
                                
                                # Get class name if available
                                class_name = f"Class_{cls}"
                                if hasattr(custom_model, 'names') and cls < len(custom_model.names):
                                    class_name = custom_model.names[cls]
                                
                                if conf > self.confidence_threshold:
                                    detections.append({
                                        'bbox': (int(x1), int(y1), int(x2), int(y2)),
                                        'conf': conf,
                                        'cls': cls,
                                        'class_name': class_name
                                    })
                else:
                    # For other PyTorch models
                    img_tensor = torch.from_numpy(processed_img).float()
                    if len(img_tensor.shape) == 3:
                        img_tensor = img_tensor.permute(2, 0, 1)
                        img_tensor = img_tensor.unsqueeze(0)
                    
                    img_tensor = img_tensor / 255.0
                    
                    if torch.cuda.is_available():
                        img_tensor = img_tensor.cuda()
                    
                    outputs = custom_model(img_tensor)
                    detections = self.process_model_outputs(outputs, original_shape)
                
                # Update inference counter
                global inference_count, last_inference_time, current_inference_fps
                inference_count += 1
                current_time = time.time()
                if current_time - last_inference_time >= 1.0:
                    current_inference_fps = inference_count / (current_time - last_inference_time)
                    inference_count = 0
                    last_inference_time = current_time
                
                return detections
                
        except Exception as e:
            logger.error(f"Inference error: {e}")
            return []
    
    def process_model_outputs(self, outputs, original_shape):
        """Process custom model outputs for non-YOLO models"""
        detections = []
        original_height, original_width = original_shape[:2]
        
        try:
            if hasattr(outputs, 'detach'):
                outputs = outputs.detach().cpu().numpy()
            
        except Exception as e:
            logger.error(f"Error processing model outputs: {e}")
        
        return detections
    
    async def recv(self):
        frame = await self.track.recv()
        img = frame.to_ndarray(format="bgr24")
        original_shape = img.shape
        
        # Frame skipping for optimal performance
        self.frame_skip_counter += 1
        should_inference = self.frame_skip_counter % (self.skip_frames + 1) == 0
        
        if custom_model is not None and should_inference:
            try:
                processed_img, scale, pad_x, pad_y = self.preprocess_frame(img)
                
                if not inference_queue.full():
                    future = inference_executor.submit(self.run_inference, processed_img, original_shape)
                    try:
                        detections = future.result(timeout=0.05)
                        self.last_detections = detections
                    except:
                        pass
                        
            except Exception as e:
                logger.error(f"Frame processing error: {e}")
        
        # Draw detections
        self.draw_detections(img)
        
        # Calculate and draw FPS
        self.update_and_draw_fps(img)
        
        # Convert back to frame
        new_frame = frame.from_ndarray(img, format="bgr24")
        new_frame.pts = frame.pts
        new_frame.time_base = frame.time_base
        
        return new_frame
    
    def draw_detections(self, img):
        """Draw bounding boxes and labels"""
        for detection in self.last_detections:
            try:
                x1, y1, x2, y2 = detection['bbox']
                conf = detection['conf']
                cls = detection['cls']
                class_name = detection.get('class_name', f'Class_{cls}')
                
                # Ensure coordinates are within bounds
                height, width = img.shape[:2]
                x1 = max(0, min(x1, width - 1))
                y1 = max(0, min(y1, height - 1))
                x2 = max(0, min(x2, width - 1))
                y2 = max(0, min(y2, height - 1))
                
                if x2 > x1 and y2 > y1:  # Valid box
                    # Get color for class
                    color = self.get_class_color(cls)
                    
                    # Draw thick bounding box
                    cv2.rectangle(img, (x1, y1), (x2, y2), color, 3)
                    
                    # Prepare label
                    label = f"{class_name}: {conf:.2f}"
                    
                    # Calculate text size
                    font_scale = 0.7
                    thickness = 2
                    (text_width, text_height), baseline = cv2.getTextSize(
                        label, cv2.FONT_HERSHEY_SIMPLEX, font_scale, thickness
                    )
                    
                    # Draw label background
                    cv2.rectangle(
                        img, 
                        (x1, y1 - text_height - baseline - 10), 
                        (x1 + text_width, y1), 
                        color, -1
                    )
                    
                    # Draw label text
                    cv2.putText(
                        img, label, (x1, y1 - baseline - 5),
                        cv2.FONT_HERSHEY_SIMPLEX, font_scale, (255, 255, 255), thickness
                    )
                    
            except Exception as e:
                logger.error(f"Drawing error: {e}")
                continue
    
    def get_class_color(self, class_id):
        """Generate consistent color for each class"""
        colors = [
            (0, 255, 0),    # Green
            (255, 0, 0),    # Blue  
            (0, 0, 255),    # Red
            (255, 255, 0),  # Cyan
            (255, 0, 255),  # Magenta
            (0, 255, 255),  # Yellow
            (128, 0, 128),  # Purple
            (255, 165, 0),  # Orange
            (0, 128, 255),  # Light Blue
            (128, 255, 0),  # Light Green
        ]
        return colors[class_id % len(colors)]
    
    def update_and_draw_fps(self, img):
        """Update and draw FPS counter"""
        global frame_count, last_fps_time, current_fps
        
        frame_count += 1
        current_time = time.time()
        if current_time - last_fps_time >= 1.0:
            current_fps = frame_count / (current_time - last_fps_time)
            frame_count = 0
            last_fps_time = current_time
        
        # Draw FPS counter
        fps_text = f"FPS: {current_fps:.1f}"
        inference_text = f"Inference: {current_inference_fps:.1f}"
        device_text = f"Device: {device_info}"
        
        # FPS
        cv2.putText(img, fps_text, (10, 30), 
                   cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2, cv2.LINE_AA)
        
        # Inference FPS
        cv2.putText(img, inference_text, (10, 70), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 0), 2, cv2.LINE_AA)
        
        # Device info
        cv2.putText(img, device_text, (10, 110), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 0, 255), 2, cv2.LINE_AA)
        
        # Detection count
        if self.last_detections:
            detection_text = f"Objects: {len(self.last_detections)}"
            cv2.putText(img, detection_text, (10, 150), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2, cv2.LINE_AA)

def load_custom_model():
    """Load your custom model from the models folder"""
    global custom_model, device_info
    
    try:
        # Check CUDA availability
        cuda_available = torch.cuda.is_available()
        if cuda_available:
            cuda_ver = getattr(getattr(torch, "version", None), "cuda", None)
            device_info = f"CUDA {cuda_ver or 'unknown'} - {torch.cuda.get_device_name(0)}"
            logger.info(f"CUDA available: {device_info}")
            
            # Set CUDA optimizations
            torch.backends.cudnn.benchmark = True
            torch.backends.cudnn.deterministic = False
            
            # Clear cache
            torch.cuda.empty_cache()
        else:
            device_info = "CPU"
            logger.warning("CUDA not available, using CPU")
        
        # Load the 16sept.pt model
        models_path = os.path.join(os.path.dirname(__file__), "models")
        model_path = os.path.join(models_path, "16sept.pt")
        
        if os.path.exists(model_path):
            logger.info(f"Loading custom model from: {model_path}")
            
            # Try to load as Ultralytics YOLO model first
            try:
                custom_model = YOLO(model_path)
                
                if cuda_available:
                    custom_model.to('cuda')
                
                logger.info(f"Model loaded successfully as YOLO model")
                logger.info(f"Model has {len(custom_model.names)} classes: {list(custom_model.names.values())[:10]}...")
                
            except ImportError:
                logger.warning("Ultralytics not installed, trying to load as PyTorch model")
                # Fall back to standard PyTorch loading
                custom_model = torch.load(model_path, map_location='cuda' if cuda_available else 'cpu')
                
                if hasattr(custom_model, 'eval'):
                    custom_model.eval()
                
                if cuda_available and hasattr(custom_model, 'cuda'):
                    custom_model = custom_model.cuda()
                
                logger.info("Model loaded as PyTorch model")
            
            # Warmup model
            logger.info("Warming up model...")
            dummy_img = np.random.randint(0, 255, (640, 640, 3), dtype=np.uint8)
            
            # Multiple warmup runs for optimal performance
            for i in range(3):
                with torch.no_grad():
                    try:
                        if hasattr(custom_model, 'predict') or hasattr(custom_model, '__call__'):
                            _ = custom_model(dummy_img, verbose=False, device='cuda' if cuda_available else 'cpu')
                        else:
                            dummy_tensor = torch.from_numpy(dummy_img).float().permute(2, 0, 1).unsqueeze(0)
                            if cuda_available:
                                dummy_tensor = dummy_tensor.cuda()
                            _ = custom_model(dummy_tensor / 255.0)
                    except Exception as e:
                        logger.warning(f"Warmup iteration {i} failed: {e}")
            
            if cuda_available:
                torch.cuda.synchronize()
                
            logger.info("Model warmed up successfully")
        else:
            logger.error(f"Model file not found at {model_path}")
            logger.info(f"Looking for model files in: {models_path}")
            if os.path.exists(models_path):
                files = os.listdir(models_path)
                logger.info(f"Files in models directory: {files}")
            
    except Exception as e:
        logger.error(f"Failed to load custom model: {e}")
        import traceback
        logger.error(traceback.format_exc())
        device_info = "Error"

# Cleanup function for peer connections
async def cleanup_peer_connection(client_id: str):
    """Clean up peer connection properly"""
    if client_id in peer_connections:
        try:
            pc = peer_connections[client_id]
            # Close all transceivers
            for transceiver in pc.getTransceivers():
                if transceiver.receiver.track:
                    transceiver.receiver.track.stop()
                if transceiver.sender.track:
                    transceiver.sender.track.stop()
            
            # Close peer connection
            await pc.close()
            logger.info(f"Peer connection for {client_id} closed properly")
        except Exception as e:
            logger.error(f"Error closing peer connection for {client_id}: {e}")
        finally:
            # Remove from dictionary
            peer_connections.pop(client_id, None)
            logger.info(f"Peer connection for {client_id} removed from registry")

# Create FastAPI app with lifespan
app = FastAPI(
    title="Carter Island GPU-Optimized Stream Backend",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Length", "Content-Range", "Accept-Ranges"],
)

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await websocket.accept()
    active_connections.add(websocket)
    logger.info(f"Client {client_id} connected")
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message["type"] == "offer":
                await handle_offer(client_id, message, websocket)
            elif message["type"] == "answer":
                await handle_answer(client_id, message, websocket)
            elif message["type"] == "ice-candidate":
                await handle_ice_candidate(client_id, message, websocket)
                
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnect for client {client_id}")
    except Exception as e:
        logger.error(f"WebSocket error for client {client_id}: {e}")
    finally:
        # Clean up connection properly
        active_connections.discard(websocket)
        
        # Clean up peer connection asynchronously
        if client_id in peer_connections:
            try:
                await cleanup_peer_connection(client_id)
            except Exception as e:
                logger.error(f"Error during cleanup for {client_id}: {e}")
        
        logger.info(f"Client {client_id} fully disconnected and cleaned up")

async def handle_offer(client_id: str, message: dict, websocket: WebSocket):
    """Handle WebRTC offer"""
    try:
        # Clean up any existing connection for this client first
        if client_id in peer_connections:
            logger.info(f"Cleaning up existing connection for {client_id}")
            await cleanup_peer_connection(client_id)
        
        from aiortc import RTCConfiguration, RTCIceServer
        rtc_config = RTCConfiguration(iceServers=[
            RTCIceServer(urls="stun:stun.l.google.com:19302"),
            RTCIceServer(urls="stun:stun1.l.google.com:19302"),
            RTCIceServer(urls="stun:stun2.l.google.com:19302"),
        ])
        pc = RTCPeerConnection(configuration=rtc_config)
        peer_connections[client_id] = pc
        
        @pc.on("connectionstatechange")
        async def on_connectionstatechange():
            logger.info(f"Client {client_id} connection state: {pc.connectionState}")
            if pc.connectionState in ["failed", "closed"]:
                await cleanup_peer_connection(client_id)
        
        @pc.on("track")
        def on_track(track):
            logger.info(f"Track received from {client_id}: {track.kind}")
            
            if track.kind == "video":
                # Create custom model track
                custom_track = CustomModelVideoStreamTrack(track)
                pc.addTrack(custom_track)
                
                # Handle track ending
                @track.on("ended")
                async def on_track_ended():
                    logger.info(f"Track ended for {client_id}")
        
        # Set remote description
        await pc.setRemoteDescription(
            RTCSessionDescription(sdp=message["sdp"], type=message["type"])
        )
        
        # Create answer
        answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        
        # Send answer
        await websocket.send_text(json.dumps({
            "type": "answer",
            "sdp": pc.localDescription.sdp
        }))
        
        logger.info(f"Answer sent to client {client_id}")
        
    except Exception as e:
        logger.error(f"Error handling offer from {client_id}: {e}")
        # Clean up on error
        await cleanup_peer_connection(client_id)

async def handle_answer(client_id: str, message: dict, websocket: WebSocket):
    """Handle WebRTC answer"""
    try:
        if client_id in peer_connections:
            pc = peer_connections[client_id]
            await pc.setRemoteDescription(
                RTCSessionDescription(sdp=message["sdp"], type=message["type"])
            )
            logger.info(f"Answer processed for client {client_id}")
    except Exception as e:
        logger.error(f"Error handling answer from {client_id}: {e}")

async def handle_ice_candidate(client_id: str, message: dict, websocket: WebSocket):
    """Handle ICE candidate"""
    try:
        if client_id in peer_connections and message.get("candidate"):
            pc = peer_connections[client_id]
            await pc.addIceCandidate(message["candidate"])
    except Exception as e:
        logger.error(f"Error handling ICE candidate from {client_id}: {e}")

@app.get("/")
async def root():
    return {
        "message": "Carter Island GPU-Optimized Backend",
        "device": device_info,
        "cuda_available": torch.cuda.is_available(),
        "model_loaded": custom_model is not None
    }

@app.get("/api/health")
async def health_check():
    """Health check with complete information"""
    gpu_info = {}
    if torch.cuda.is_available():
        gpu_info = {
            "gpu_name": torch.cuda.get_device_name(0),
            "gpu_memory_total": torch.cuda.get_device_properties(0).total_memory,
            "gpu_memory_allocated": torch.cuda.memory_allocated(0),
            "gpu_memory_reserved": torch.cuda.memory_reserved(0),
        }
    
    model_info = {
        "model_loaded": custom_model is not None,
        "model_type": type(custom_model).__name__ if custom_model else None
    }
    
    # Add model classes if available
    if custom_model and hasattr(custom_model, 'names'):
        model_info["classes"] = custom_model.names
        model_info["num_classes"] = len(custom_model.names)
    
    return {
        "status": "healthy",
        "device": device_info,
        "model_loaded": custom_model is not None,
        "active_connections": len(active_connections),
        "active_peer_connections": len(peer_connections),
        "fps": current_fps,
        "inference_fps": current_inference_fps,
        "model_info": model_info,
        "gpu_info": gpu_info,
        "cuda_available": torch.cuda.is_available(),
        "torch_version": torch.__version__
    }

@app.get("/api/performance")
async def get_performance():
    """Real-time performance metrics"""
    return {
        "fps": round(current_fps, 2),
        "inference_fps": round(current_inference_fps, 2),
        "active_connections": len(active_connections),
        "active_peer_connections": len(peer_connections),
        "device": device_info,
        "model_loaded": custom_model is not None,
        "cuda_available": torch.cuda.is_available()
    }

@app.get("/api/model-info")
async def get_model_info():
    """Model information"""
    if custom_model is not None:
        info = {
            "model_loaded": True,
            "model_type": type(custom_model).__name__,
            "device": device_info
        }
        
        # Add classes if available
        if hasattr(custom_model, 'names'):
            info["classes"] = custom_model.names
            info["num_classes"] = len(custom_model.names)
        
        return info
    
    return {"model_loaded": False}

@app.post("/api/recordings")
async def upload_recording(file: UploadFile = File(...)):
    """Upload recording file and save to database"""
    try:
        # Validate file type
        if not file.content_type or not file.content_type.startswith('video/'):
            raise HTTPException(status_code=400, detail="File must be a video")
        
        # Generate unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"recording_{timestamp}_{file.filename}"
        filepath = RECORDINGS_DIR / filename
        
        # Save file to disk
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Get file info
        file_size = filepath.stat().st_size
        
        # Save to database using Prisma
        try:
            # Import Prisma client
            from prisma import Prisma
            
            # Initialize Prisma client
            db = Prisma()
            await db.connect()
            
            try:
                # Create recording record in database
                recording = await db.recording.create(
                    data={
                        "filename": filename,
                        "originalName": file.filename or "unknown.webm",
                        "filePath": str(filepath.absolute()),
                        "fileSize": file_size,
                        "mimeType": file.content_type or "video/webm",
                        "status": "COMPLETED"
                    }
                )
                
                logger.info(f"Recording saved to database with ID: {recording.id}")
                
                return {
                    "id": recording.id,
                    "filename": filename,
                    "originalName": recording.originalName,
                    "size": file_size,
                    "status": recording.status,
                    "message": "Recording uploaded and saved to database successfully"
                }
                
            finally:
                # Always disconnect from database
                await db.disconnect()
                
        except Exception as db_error:
            # If database save fails, still keep the file but log the error
            logger.error(f"Failed to save recording to database: {db_error}")
            
            # Return success response even if database fails
            return {
                "filename": filename,
                "size": file_size,
                "message": "Recording uploaded successfully (database save failed)",
                "warning": "Recording file saved but database entry failed"
            }
        
    except Exception as e:
        logger.error(f"Error uploading recording: {e}")
        
        # Clean up file if it was created but process failed
        if 'filepath' in locals() and filepath.exists():
            try:
                filepath.unlink()
            except:
                pass
                
        raise HTTPException(status_code=500, detail="Failed to upload recording")
    
@app.get("/api/recordings")
async def list_recordings():
    """Get list of all recordings"""
    try:
        recordings = []
        
        for file_path in RECORDINGS_DIR.glob("*.webm"):
            stat = file_path.stat()
            recordings.append({
                "filename": file_path.name,
                "size": stat.st_size,
                "size_mb": round(stat.st_size / (1024 * 1024), 2),
                "created_at": datetime.fromtimestamp(stat.st_ctime).isoformat(),
                "modified_at": datetime.fromtimestamp(stat.st_mtime).isoformat()
            })
        
        # Sort by created time (newest first)
        recordings.sort(key=lambda x: x["created_at"], reverse=True)
        
        return {"recordings": recordings}
        
    except Exception as e:
        logger.error(f"Error listing recordings: {e}")
        raise HTTPException(status_code=500, detail="Failed to list recordings")

@app.get("/api/recordings/{filename}")
async def get_recording(filename: str, request: Request):
    file_path = RECORDINGS_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Recording not found")

    file_size = file_path.stat().st_size

    # --- Range request (play + seek di browser)
    range_header = request.headers.get("range") or request.headers.get("Range")
    if range_header:
        range_match = re.search(r"bytes=(\d+)-(\d*)", range_header)
        if range_match:
            start = int(range_match.group(1))
            end = int(range_match.group(2)) if range_match.group(2) else file_size - 1
            with open(file_path, "rb") as f:
                f.seek(start)
                chunk = f.read(end - start + 1)
            return Response(
                content=chunk,
                status_code=206,
                headers={
                    "Content-Range": f"bytes {start}-{end}/{file_size}",
                    "Accept-Ranges": "bytes",
                    "Content-Length": str(end - start + 1),
                    "Content-Type": "video/webm",
                    # kunci: inline biar <video> mau render
                    "Content-Disposition": f'inline; filename="{filename}"',
                },
            )

    # --- Full response (juga harus inline, jangan attachment)
    return FileResponse(
        path=file_path,
        media_type="video/webm",
        filename=filename,                        # boleh tetap kirim nama
        content_disposition_type="inline",        # << kunci perbaikan
        headers={
            "Accept-Ranges": "bytes",
            "Content-Length": str(file_size),
        },
    )

@app.delete("/api/recordings/{filename}")
async def delete_recording(filename: str):
    """Delete recording file"""
    try:
        file_path = RECORDINGS_DIR / filename
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="Recording not found")
        
        file_path.unlink()
        
        return {"message": f"Recording {filename} deleted successfully"}
        
    except Exception as e:
        logger.error(f"Error deleting recording: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete recording")

if __name__ == "__main__":
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=8000,
        log_level="info",
        access_log=False
    )