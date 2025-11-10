import os
import uuid

# ==========================
# Streaming / Encoder Settings
# ==========================
RTSP_URL = os.getenv("RTSP_URL", "rtsp://192.168.2.2:8554/cam")
RTSP_TRANSPORT = os.getenv("RTSP_TRANSPORT", "udp")
TARGET_FPS = int(os.getenv("TARGET_FPS", "30"))
RESIZE_WIDTH = int(os.getenv("RESIZE_WIDTH", "1280"))
RESIZE_HEIGHT = int(os.getenv("RESIZE_HEIGHT", "720"))

# ==========================
# Bitrate Control
# ==========================
MAX_BITRATE_KBPS_DEFAULT = int(os.getenv("MAX_BITRATE_KBPS", "4500"))
MIN_BITRATE_KBPS_FLOOR = int(os.getenv("MIN_BITRATE_KBPS", "2500"))
BITRATE_REAPPLY_SEC = float(os.getenv("BITRATE_REAPPLY_SEC", "4.0"))
PREFER_CODEC = os.getenv("PREFER_CODEC", "h264").lower()
DISABLE_TWCC_REM = os.getenv("DISABLE_TWCC_REMB", "1") == "1"

# ==========================
# Database Saving Config
# ==========================
SAVE_DETECTIONS_ENABLED = os.getenv("SAVE_DETECTIONS_ENABLED", "true").lower() == "true"
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:3000")
SAVE_INTERVAL_SECONDS = float(os.getenv("SAVE_INTERVAL_SECONDS", "5.0"))
MIN_DETECTIONS_TO_SAVE = int(os.getenv("MIN_DETECTIONS_TO_SAVE", "1"))

# ==========================
# Recording Settings
# ==========================
import tempfile
RECORDINGS_DIR = tempfile.gettempdir()

# ==========================
# Model Settings
# ==========================
MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "16sept.pt")
YOLO_CONF_THRESHOLD = float(os.getenv("YOLO_CONF_THRESHOLD", "0.45"))
YOLO_IOU_THRESHOLD = float(os.getenv("YOLO_IOU_THRESHOLD", "0.5"))
YOLO_MAX_DETECTIONS = int(os.getenv("YOLO_MAX_DETECTIONS", "30"))

# ==========================
# Session ID
# ==========================
streaming_session_id = str(uuid.uuid4())
