from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import json
import logging
import time
from detector import YOLODetector
from config import *

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="YOLO WebSocket API", version="1.0.0")

# CORS untuk Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],  # Sesuaikan dengan Next.js port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global detector instance
detector = YOLODetector()

@app.on_event("startup")
async def startup_event():
    """Initialize model on startup"""
    logger.info("Initializing YOLO detector...")
    success = detector.load_model()
    if not success:
        logger.error("Failed to initialize detector!")
        raise RuntimeError("Model initialization failed")
    logger.info("✅ YOLO WebSocket API ready!")

@app.get("/")
async def root():
    return {
        "message": "YOLO WebSocket API", 
        "version": "1.0.0",
        "websocket_endpoint": "/ws",
        "config": {
            "img_size": f"{IMG_WIDTH}x{IMG_HEIGHT}",
            "target_fps": TARGET_FPS,
            "conf_threshold": CONF_THRESHOLD,
            "device": detector.device if detector.model else "not_loaded"
        }
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "model_loaded": detector.model is not None,
        "device": detector.device if detector.model else None
    }

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []
        self.frame_queue = asyncio.Queue(maxsize=QUEUE_MAXSIZE)
        
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"Client connected. Active connections: {len(self.active_connections)}")
        
    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"Client disconnected. Active connections: {len(self.active_connections)}")

manager = ConnectionManager()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    
    try:
        while True:
            # Receive binary frame data
            data = await websocket.receive_bytes()
            
            # Drop-late strategy: jika queue penuh, skip frame lama
            if manager.frame_queue.full():
                try:
                    manager.frame_queue.get_nowait()  # Remove old frame
                except:
                    pass
            
            # Add new frame
            try:
                manager.frame_queue.put_nowait(data)
            except:
                continue  # Queue masih penuh, skip frame
                
            # Process frame (non-blocking)
            try:
                frame_data = manager.frame_queue.get_nowait()
                overlay_bytes, metadata = detector.predict(frame_data)
                
                # Send back overlay image
                await websocket.send_bytes(overlay_bytes)
                
                # Optionally send metadata as text message
                await websocket.send_text(json.dumps(metadata))
                
            except asyncio.QueueEmpty:
                continue
            except Exception as e:
                logger.error(f"Processing error: {e}")
                continue
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app", 
        host=WS_HOST, 
        port=WS_PORT, 
        reload=False,  # Disable untuk production
        ws_ping_interval=20,
        ws_ping_timeout=20
    )