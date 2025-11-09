"""
Video detection track with YOLO inference
"""
import cv2
import time
import asyncio
import logging
import numpy as np
from typing import Optional, List, Tuple
from aiortc import VideoStreamTrack
from av import VideoFrame

from config import (
    RESIZE_WIDTH,
    RESIZE_HEIGHT,
    YOLO_CONF_THRESHOLD,
    YOLO_IOU_THRESHOLD,
    YOLO_MAX_DETECTIONS,
    SAVE_DETECTIONS_ENABLED,
    SAVE_INTERVAL_SECONDS,
    MIN_DETECTIONS_TO_SAVE
)
from models.yolo_detector import run_inference, get_device_info
from database.detections import save_detections_to_db

logger = logging.getLogger("carter-backend")

# Performance counters
frame_count = 0
inference_count = 0
last_fps_time = time.time()
last_infer_time = time.time()
current_fps = 0.0
current_infer_fps = 0.0


class RtspDetectionTrack(VideoStreamTrack):
    """Video stream track with YOLO detection and overlay"""

    def __init__(self, video_source_track):
        super().__init__()
        self.src = video_source_track
        self.frame_skip = 0
        self.skip_n = 0  # 0 = process every frame
        self.last_dets: List[Tuple[int, int, int, int, float, str]] = []

        self.size = (RESIZE_WIDTH, RESIZE_HEIGHT) if (RESIZE_WIDTH and RESIZE_HEIGHT) else None
        self.conf = YOLO_CONF_THRESHOLD
        self.iou = YOLO_IOU_THRESHOLD
        self.max_det = YOLO_MAX_DETECTIONS

        # Database saving
        self.last_save_time = time.time()
        self.save_task: Optional[asyncio.Task] = None

        # Recording support
        self.recording = False
        self.video_writer: Optional[cv2.VideoWriter] = None
        self.last_frame_time = None
        self.target_frame_interval = 1.0 / 30.0  # 30 FPS = 0.0333 seconds per frame

    async def recv(self) -> VideoFrame:
        """Receive and process a video frame"""
        global frame_count, last_fps_time, current_fps
        global inference_count, last_infer_time, current_infer_fps

        frame: VideoFrame = await self.src.recv()
        img = frame.to_ndarray(format="bgr24")

        if self.size:
            img = cv2.resize(img, self.size, interpolation=cv2.INTER_LINEAR)

        # Run inference
        do_infer = (self.frame_skip % (self.skip_n + 1) == 0)
        if do_infer:
            try:
                dets = run_inference(img, self.conf, self.iou, self.max_det)
                self.last_dets = dets

                # Save detections to database periodically
                now = time.time()
                if (SAVE_DETECTIONS_ENABLED and
                    len(dets) >= MIN_DETECTIONS_TO_SAVE and
                    now - self.last_save_time >= SAVE_INTERVAL_SECONDS):
                    # Save without blocking
                    if self.save_task is None or self.save_task.done():
                        self.save_task = asyncio.create_task(
                            save_detections_to_db(dets.copy(), self.frame_skip)
                        )
                        self.last_save_time = now

            except Exception as e:
                logger.warning(f"Inference error: {e}")
            finally:
                inference_count += 1
                now = time.time()
                if now - last_infer_time >= 1.0:
                    current_infer_fps = inference_count / (now - last_infer_time)
                    inference_count = 0
                    last_infer_time = now

        self.frame_skip += 1

        # Draw overlay
        for (x1, y1, x2, y2, conf, name) in self.last_dets:
            cv2.rectangle(img, (x1, y1), (x2, y2), (50, 220, 50), 3)
            label = f"{name} {conf:.2f}"
            cv2.putText(img, label, (x1, max(0, y1 - 8)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

        # Performance text
        frame_count += 1
        now = time.time()
        if now - last_fps_time >= 1.0:
            current_fps = frame_count / (now - last_fps_time)
            frame_count = 0
            last_fps_time = now

        device = get_device_info()
        cv2.putText(img, f"FPS: {current_fps:.1f}", (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 255, 0), 2)
        cv2.putText(img, f"Inference: {current_infer_fps:.1f}", (10, 70),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)
        cv2.putText(img, f"Device: {device}", (10, 110),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 0, 255), 2)

        # Write to video file if recording with proper frame timing
        if self.recording and self.video_writer is not None:
            current_time = time.time()

            # Initialize timing on first frame
            if self.last_frame_time is None:
                self.last_frame_time = current_time
                self.video_writer.write(img)
            else:
                # Only write frame if enough time has passed (30 FPS = ~33ms per frame)
                time_since_last = current_time - self.last_frame_time
                if time_since_last >= self.target_frame_interval:
                    self.video_writer.write(img)
                    self.last_frame_time = current_time

        img = img.astype(np.uint8)
        out = VideoFrame.from_ndarray(img, format="bgr24")
        out.pts = frame.pts
        out.time_base = frame.time_base
        return out

    def start_recording(self, video_writer: cv2.VideoWriter):
        """Start recording frames to video file"""
        self.recording = True
        self.video_writer = video_writer
        self.last_frame_time = None  # Reset frame timing
        logger.info("Started recording video frames at 30 FPS")

    def stop_recording(self):
        """Stop recording frames"""
        self.recording = False
        if self.video_writer is not None:
            self.video_writer.release()
            self.video_writer = None
        self.last_frame_time = None  # Reset frame timing
        logger.info("Stopped recording video frames")


def get_fps() -> float:
    """Get current FPS"""
    return current_fps


def get_inference_fps() -> float:
    """Get current inference FPS"""
    return current_infer_fps
