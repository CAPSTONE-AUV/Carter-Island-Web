import torch
import cv2
import numpy as np
from ultralytics import YOLO
from PIL import Image
import io
import time
from typing import Optional, Tuple, List
import logging
from config import *

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class YOLODetector:
    def __init__(self):
        self.model: Optional[YOLO] = None
        self.device = self._get_device()
        self.processing_times: List[float] = []
        
    def _get_device(self) -> str:
        """Automatically detect best available device"""
        if torch.cuda.is_available():
            device = "cuda:0"
            # Enable optimizations for CUDA
            torch.backends.cudnn.benchmark = True
            logger.info(f"Using GPU: {torch.cuda.get_device_name(0)}")
        else:
            device = "cpu"
            logger.info("Using CPU (GPU not available)")
        return device
        
    def load_model(self) -> bool:
        """Load YOLOv8 model and optimize for inference"""
        try:
            logger.info(f"Loading model from: {MODEL_PATH}")
            self.model = YOLO(str(MODEL_PATH))
            
            # Move to device
            if self.device.startswith("cuda"):
                self.model.to(self.device)
                
            # Warm up model dengan dummy inference
            logger.info("Warming up model...")
            dummy_image = np.random.randint(0, 255, (IMG_HEIGHT, IMG_WIDTH, 3), dtype=np.uint8)
            
            for i in range(WARM_UP_RUNS):
                start_time = time.time()
                _ = self.model.predict(
                    dummy_image,
                    imgsz=IMG_WIDTH,
                    conf=CONF_THRESHOLD,
                    iou=IOU_THRESHOLD,
                    verbose=False,
                    device=self.device,
                    half=USE_FP16 and self.device.startswith("cuda")
                )
                warm_time = (time.time() - start_time) * 1000
                logger.info(f"Warm-up run {i+1}: {warm_time:.2f}ms")
                
            logger.info("Model ready for inference!")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            return False
    
    def predict(self, image_bytes: bytes) -> Tuple[bytes, dict]:
        """
        Perform inference and return overlay image + metadata
        """
        start_time = time.time()
        
        try:
            # Decode image dari bytes
            image = Image.open(io.BytesIO(image_bytes))
            image_np = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
            
            # Resize jika perlu (maintain aspect ratio)
            if image_np.shape[:2] != (IMG_HEIGHT, IMG_WIDTH):
                image_np = cv2.resize(image_np, (IMG_WIDTH, IMG_HEIGHT))
            
            # Run inference dengan optimizations
            with torch.inference_mode():  # Disable gradient calculation
                if USE_FP16 and self.device.startswith("cuda"):
                    with torch.cuda.amp.autocast():
                        results = self.model.predict(
                            image_np,
                            imgsz=IMG_WIDTH,
                            conf=CONF_THRESHOLD,
                            iou=IOU_THRESHOLD,
                            verbose=False,
                            device=self.device,
                            half=True
                        )
                else:
                    results = self.model.predict(
                        image_np,
                        imgsz=IMG_WIDTH,
                        conf=CONF_THRESHOLD,
                        iou=IOU_THRESHOLD,
                        verbose=False,
                        device=self.device
                    )
            
            # Get result with overlay
            result = results[0]
            annotated_frame = result.plot()  # Gambar bounding boxes
            
            # Convert kembali ke bytes (JPEG)
            _, buffer = cv2.imencode('.jpg', annotated_frame, 
                                   [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
            overlay_bytes = buffer.tobytes()
            
            # Calculate processing time
            processing_time = (time.time() - start_time) * 1000
            self.processing_times.append(processing_time)
            
            # Keep only last 100 measurements
            if len(self.processing_times) > 100:
                self.processing_times.pop(0)
            
            # Metadata
            detections = len(result.boxes) if result.boxes is not None else 0
            avg_time = sum(self.processing_times) / len(self.processing_times)
            
            metadata = {
                "detections": detections,
                "processing_time_ms": round(processing_time, 2),
                "avg_processing_time_ms": round(avg_time, 2),
                "fps": round(1000 / processing_time, 1) if processing_time > 0 else 0,
                "device": self.device
            }
            
            return overlay_bytes, metadata
            
        except Exception as e:
            logger.error(f"Prediction error: {e}")
            # Return original image on error
            return image_bytes, {"error": str(e), "detections": 0}