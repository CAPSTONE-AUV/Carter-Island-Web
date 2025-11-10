import logging
import torch
from contextlib import asynccontextmanager
from concurrent.futures import ThreadPoolExecutor

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import SAVE_DETECTIONS_ENABLED, SAVE_INTERVAL_SECONDS, API_BASE_URL
from models.yolo_detector import load_custom_model, get_device_info
from database.detections import initialize_http_client, close_http_client
from video.recording import initialize_recordings_dir, cleanup_all_recordings
from webrtc.peer_connection import cleanup_all
from api.routes import setup_routes

# ==========================
# Logging Setup
# ==========================
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("carter-backend")

# ==========================
# Global Resources
# ==========================
inference_executor = ThreadPoolExecutor(max_workers=2)


# ==========================
# Lifespan Manager
# ==========================
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=" * 60)
    logger.info("Starting Carter Island Backend...")
    logger.info("=" * 60)

    # Load YOLO model
    load_custom_model()
    logger.info(f"Device: {get_device_info()}")

    # Initialize HTTP client for database operations
    if SAVE_DETECTIONS_ENABLED:
        await initialize_http_client()
        logger.info(f"Database saving enabled")
        logger.info(f"API endpoint: {API_BASE_URL}/api/detections")
        logger.info(f"Save interval: {SAVE_INTERVAL_SECONDS}s")
    else:
        logger.info("Database saving disabled")

    logger.info("=" * 60)
    logger.info("Backend ready!")
    logger.info("=" * 60)

    yield

    # Shutdown
    logger.info("Shutting down...")
    try:
        # Close HTTP client
        await close_http_client()

        # Cleanup all recordings
        cleanup_all_recordings()

        # Close all peer connections
        await cleanup_all()

        # Shutdown executor
        inference_executor.shutdown(wait=True)

        # Clear GPU memory
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

        logger.info("Shutdown complete")
    except Exception as e:
        logger.warning(f"Shutdown error: {e}")


# ==========================
# FastAPI App
# ==========================
app = FastAPI(
    title="Carter Island GPU-Optimized Stream Backend",
    description="Real-time fish detection with YOLO and WebRTC streaming",
    version="2.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Setup routes
setup_routes(app)


# ==========================
# Main Entry Point
# ==========================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        log_level="info",
        access_log=False
    )
