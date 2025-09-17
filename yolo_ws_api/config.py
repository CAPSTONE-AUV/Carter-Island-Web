import os
from pathlib import Path

# Environment Variables dengan fallback defaults
WS_HOST = os.getenv("WS_HOST", "0.0.0.0")
WS_PORT = int(os.getenv("WS_PORT", "8000"))
IMG_WIDTH = int(os.getenv("IMG_WIDTH", "640"))
IMG_HEIGHT = int(os.getenv("IMG_HEIGHT", "640"))
TARGET_FPS = int(os.getenv("FPS", "30"))
JPEG_QUALITY = int(os.getenv("QUALITY", "60"))

# Model Configuration - GANTI KE MODEL ANDA
MODEL_PATH = Path("yolo_models/testyolo.pt")  # ← PERUBAHAN DI SINI
CONF_THRESHOLD = float(os.getenv("CONF_THRESHOLD", "0.25"))
IOU_THRESHOLD = float(os.getenv("IOU_THRESHOLD", "0.45"))
USE_FP16 = os.getenv("USE_FP16", "fakse").lower() == "true"

# Performance Settings
QUEUE_MAXSIZE = 1  # Drop-late strategy
WARM_UP_RUNS = 3