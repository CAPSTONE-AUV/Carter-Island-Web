import os
import cv2
import logging
import httpx
from typing import Optional, Dict
from datetime import datetime
import pytz
from config import (
    RECORDINGS_DIR,
    RESIZE_WIDTH,
    RESIZE_HEIGHT,
    API_BASE_URL,
    streaming_session_id
)

# Jakarta timezone
JAKARTA_TZ = pytz.timezone('Asia/Jakarta')

logger = logging.getLogger("carter-backend")

# Active recordings
active_recordings: Dict[str, dict] = {}


def initialize_recordings_dir():
    """
    Deprecated: Recordings directory initialization removed.
    Using system temp directory instead to avoid local storage.
    """
    logger.info(f"Recordings will be stored in system temp directory: {RECORDINGS_DIR}")


def create_video_writer(recording_id: str) -> Optional[cv2.VideoWriter]:
    try:
        filename = f"recording_{recording_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.mp4"
        filepath = os.path.join(RECORDINGS_DIR, filename)

        # Use H.264 codec for better compatibility
        fourcc = cv2.VideoWriter.fourcc(*'mp4v')

        writer = cv2.VideoWriter(
            filepath,
            fourcc,
            RECORDING_FPS,
            (RESIZE_WIDTH, RESIZE_HEIGHT)
        )

        if not writer.isOpened():
            logger.error(f"Failed to open video writer for {filepath}")
            return None

        logger.info(f"Created video writer: {filepath}")
        return writer

    except Exception as e:
        logger.error(f"Error creating video writer: {e}")
        return None


async def start_recording(client_id: str, detection_track) -> Optional[str]:
    """
    Start recording for a client

    Args:
        client_id: Client identifier
        detection_track: RtspDetectionTrack instance

    Returns:
        recording_id if successful, None otherwise
    """
    if client_id in active_recordings:
        logger.warning(f"Client {client_id} is already recording")
        return None

    try:
        # Import here to avoid circular dependency
        from video.detection_track import get_fps

        recording_id = f"{client_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        filename = f"recording_{recording_id}.webm"
        filepath = os.path.join(RECORDINGS_DIR, filename)

        # Get actual stream FPS for recording
        actual_fps = get_fps()
        if actual_fps <= 0:
            actual_fps = 10.0  # Default to 10 FPS if not yet calculated

        logger.info(f"Recording at {actual_fps:.1f} FPS (full stream rate)")

        # Create video writer with WebM format (VP8 codec) for browser compatibility
        # WebM is natively supported by all modern browsers
        fourcc_options = [
            cv2.VideoWriter.fourcc(*'VP80'),  # VP8 codec for WebM
            cv2.VideoWriter.fourcc(*'VP90'),  # VP9 codec (fallback)
        ]

        writer = None
        for fourcc in fourcc_options:
            writer = cv2.VideoWriter(
                filepath,
                fourcc,
                actual_fps,  # Use actual stream FPS (10 FPS)
                (RESIZE_WIDTH, RESIZE_HEIGHT)
            )
            if writer.isOpened():
                logger.info(f"Using codec: {fourcc} at {actual_fps:.1f} FPS")
                break
            writer.release()
            writer = None

        if writer is None or not writer.isOpened():
            logger.error(f"Failed to open video writer for {filepath}")
            return None

        # Start recording on detection track
        detection_track.start_recording(writer)

        # Store recording info (use Jakarta timezone)
        active_recordings[client_id] = {
            "recording_id": recording_id,
            "filename": filename,
            "filepath": filepath,
            "writer": writer,
            "start_time": datetime.now(JAKARTA_TZ),
            "session_id": streaming_session_id
        }

        logger.info(f"Started recording for client {client_id}: {filename}")
        return recording_id

    except Exception as e:
        logger.error(f"Error starting recording: {e}")
        return None


async def stop_recording(client_id: str) -> Optional[dict]:
    """
    Stop recording for a client and save to database

    Args:
        client_id: Client identifier

    Returns:
        Recording info dict if successful, None otherwise
    """
    if client_id not in active_recordings:
        logger.warning(f"Client {client_id} is not recording")
        return None

    try:
        recording_info = active_recordings.pop(client_id)
        recording_id = recording_info["recording_id"]
        filepath = recording_info["filepath"]
        writer = recording_info["writer"]

        # Stop writing
        writer.release()

        # Get file info (use Jakarta timezone)
        file_size = os.path.getsize(filepath)
        end_time = datetime.now(JAKARTA_TZ)
        duration = (end_time - recording_info["start_time"]).total_seconds()

        recording_data = {
            "recording_id": recording_id,
            "filename": recording_info["filename"],
            "filepath": filepath,
            "file_size": file_size,
            "duration": duration,
            "start_time": recording_info["start_time"].isoformat(),
            "end_time": end_time.isoformat(),
            "session_id": recording_info["session_id"]
        }

        logger.info(f"Stopped recording for client {client_id}: {recording_info['filename']} ({duration:.1f}s, {file_size/1024/1024:.2f}MB)")

        # Save to database via API
        try:
            async with httpx.AsyncClient(timeout=10.0) as http_client:
                response = await http_client.post(
                    f"{API_BASE_URL}/api/recordings",
                    json={
                        "sessionId": recording_info["session_id"],
                        "filename": recording_info["filename"],
                        "filepath": filepath,
                        "fileSize": file_size,
                        "duration": duration,
                        "startTime": recording_info["start_time"].isoformat(),
                        "endTime": end_time.isoformat()
                    },
                    timeout=5.0
                )

                if response.status_code == 201:
                    logger.info(f"✓ Saved recording to database: {recording_info['filename']}")
                else:
                    logger.warning(f"Failed to save recording to database: HTTP {response.status_code}")

        except Exception as e:
            logger.error(f"Error saving recording to database: {e}")

        return recording_data

    except Exception as e:
        logger.error(f"Error stopping recording: {e}")
        return None


def is_recording(client_id: str) -> bool:
    """Check if a client is currently recording"""
    return client_id in active_recordings


def get_recording_info(client_id: str) -> Optional[dict]:
    """Get recording info for a client"""
    return active_recordings.get(client_id)


def cleanup_all_recordings():
    """Stop and cleanup all active recordings"""
    for client_id in list(active_recordings.keys()):
        recording_info = active_recordings.pop(client_id)
        try:
            recording_info["writer"].release()
            logger.info(f"Cleaned up recording for client {client_id}")
        except Exception as e:
            logger.error(f"Error cleaning up recording for {client_id}: {e}")
