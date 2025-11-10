/**
 * Utility functions untuk manage AUV status tracking
 */

export interface AUVStatusUpdate {
  isOnline: boolean;
  connectionStrength: 'Strong' | 'Moderate' | 'Weak' | 'Disconnected';
  uptimeSeconds: number;
  locationStatus?: string;
  lastStreamTime?: Date;
}

/**
 * Calculate connection strength berdasarkan performance metrics
 */
export function calculateConnectionStrength(
  fps?: number,
  targetFps: number = 30
): 'Strong' | 'Moderate' | 'Weak' | 'Disconnected' {
  if (!fps || fps === 0) {
    return 'Disconnected';
  }

  const fpsRatio = fps / targetFps;

  if (fpsRatio >= 0.8) {
    // >= 80% dari target FPS
    return 'Strong';
  } else if (fpsRatio >= 0.5) {
    // 50-80% dari target FPS
    return 'Moderate';
  } else {
    // < 50% dari target FPS
    return 'Weak';
  }
}

/**
 * Calculate uptime dalam detik berdasarkan stream start time
 */
export function calculateUptime(startTime: Date | null): number {
  if (!startTime) return 0;

  const now = new Date();
  const diffMs = now.getTime() - startTime.getTime();
  return Math.floor(diffMs / 1000); // Convert to seconds
}

/**
 * Update AUV status ke database via API
 */
export async function updateAUVStatus(
  status: AUVStatusUpdate
): Promise<boolean> {
  try {
    const response = await fetch('/api/auv-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(status),
    });

    if (!response.ok) {
      console.error('Failed to update AUV status:', response.statusText);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error updating AUV status:', error);
    return false;
  }
}

/**
 * Update AUV status saat stream connect
 */
export async function updateStreamConnected(
  streamStartTime: Date
): Promise<boolean> {
  const uptime = calculateUptime(streamStartTime);

  return updateAUVStatus({
    isOnline: true,
    connectionStrength: 'Strong', // Initial connection
    uptimeSeconds: uptime,
    locationStatus: 'Active',
    lastStreamTime: new Date(),
  });
}

/**
 * Update AUV status saat stream disconnect
 */
export async function updateStreamDisconnected(): Promise<boolean> {
  return updateAUVStatus({
    isOnline: false,
    connectionStrength: 'Disconnected',
    uptimeSeconds: 0,
    locationStatus: 'Active',
    lastStreamTime: new Date(),
  });
}

/**
 * Update AUV status dengan performance metrics
 */
export async function updateStreamPerformance(
  streamStartTime: Date | null,
  fps: number,
  targetFps: number = 30
): Promise<boolean> {
  const uptime = calculateUptime(streamStartTime);
  const strength = calculateConnectionStrength(fps, targetFps);

  return updateAUVStatus({
    isOnline: streamStartTime !== null,
    connectionStrength: strength,
    uptimeSeconds: uptime,
    locationStatus: 'Active',
    lastStreamTime: streamStartTime || undefined,
  });
}
