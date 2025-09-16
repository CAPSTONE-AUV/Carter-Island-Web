'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface StreamComponentProps {
  apiUrl?: string;
}

interface PerformanceData {
  fps: number;
  inference_fps: number;
  active_connections: number;
  device: string;
  model_loaded: boolean;
  cuda_available: boolean;
}

interface ModelInfo {
  model_loaded: boolean;
  classes?: Record<string, string>;
  num_classes?: number;
  device?: string;
}

export default function StreamComponent({ 
  apiUrl = 'ws://localhost:8000' 
}: StreamComponentProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  
  const [isStreaming, setIsStreaming] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null);
  const [error, setError] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);

  const websocketRef = useRef<WebSocket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const performanceIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const clientId = useRef(Math.random().toString(36).substring(7)).current;

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 9)]);
  }, []);

  // Fetch model info
  useEffect(() => {
    const fetchModelInfo = async () => {
      try {
        const httpUrl = apiUrl.replace('ws://', 'http://').replace('wss://', 'https://');
        const response = await fetch(`${httpUrl}/api/model-info`);
        const data = await response.json();
        setModelInfo(data);
        addLog(`Model loaded: ${data.model_loaded ? 'Yes' : 'No'}`);
        if (data.device) {
          addLog(`Device: ${data.device}`);
        }
      } catch (error) {
        console.error('Error fetching model info:', error);
        setError('Failed to fetch model info');
        addLog('Failed to fetch model info');
      }
    };
    
    fetchModelInfo();
  }, [apiUrl, addLog]);

  // Performance monitoring
  useEffect(() => {
    const monitorPerformance = async () => {
      try {
        const httpUrl = apiUrl.replace('ws://', 'http://').replace('wss://', 'https://');
        const response = await fetch(`${httpUrl}/api/performance`);
        const data = await response.json();
        setPerformanceData(data);
      } catch (error) {
        console.error('Error fetching performance data:', error);
      }
    };

    if (isStreaming) {
      performanceIntervalRef.current = setInterval(monitorPerformance, 1000);
    } else if (performanceIntervalRef.current) {
      clearInterval(performanceIntervalRef.current);
      performanceIntervalRef.current = null;
    }

    return () => {
      if (performanceIntervalRef.current) {
        clearInterval(performanceIntervalRef.current);
      }
    };
  }, [apiUrl, isStreaming]);

  const initializeWebRTC = async () => {
    try {
      setError('');
      setConnectionStatus('connecting');
      addLog('Initializing WebRTC connection...');
      
      // Setup WebSocket
      websocketRef.current = new WebSocket(`${apiUrl}/ws/${clientId}`);
      
      websocketRef.current.onopen = () => {
        setConnectionStatus('connected');
        addLog('WebSocket connected successfully');
      };

      websocketRef.current.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);
          await handleMessage(message);
        } catch (error) {
          console.error('Error handling message:', error);
          addLog('Error handling WebSocket message');
        }
      };

      websocketRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('error');
        setError('WebSocket connection failed');
        addLog('WebSocket connection failed');
      };

      websocketRef.current.onclose = (event) => {
        setConnectionStatus('disconnected');
        addLog(`WebSocket closed: ${event.code}`);
      };

      // Setup WebRTC with optimized configuration
      peerConnectionRef.current = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ],
        iceCandidatePoolSize: 10
      });

      peerConnectionRef.current.ontrack = (event) => {
        addLog('Received remote video track');
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      peerConnectionRef.current.onicecandidate = (event) => {
        if (event.candidate && websocketRef.current) {
          websocketRef.current.send(JSON.stringify({
            type: 'ice-candidate',
            candidate: event.candidate
          }));
        }
      };

      peerConnectionRef.current.onconnectionstatechange = () => {
        const state = peerConnectionRef.current?.connectionState;
        addLog(`RTC connection state: ${state}`);
      };

      peerConnectionRef.current.oniceconnectionstatechange = () => {
        const state = peerConnectionRef.current?.iceConnectionState;
        addLog(`ICE connection state: ${state}`);
      };

    } catch (error) {
      console.error('Error initializing WebRTC:', error);
      setConnectionStatus('error');
      setError('Failed to initialize WebRTC');
      addLog('Failed to initialize WebRTC');
    }
  };

  const startStream = async () => {
    try {
      setError('');
      addLog('Starting camera stream...');
      
      // Request camera dengan optimized settings untuk GPU processing
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 60 },
          facingMode: 'environment' // Use back camera jika available
        },
        audio: false // Disable audio untuk focus pada video processing
      });

      localStreamRef.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        addLog(`Camera resolution: ${stream.getVideoTracks()[0].getSettings().width}x${stream.getVideoTracks()[0].getSettings().height}`);
      }

      // Add tracks to peer connection
      if (peerConnectionRef.current) {
        stream.getTracks().forEach(track => {
          peerConnectionRef.current!.addTrack(track, stream);
        });

        // Create and send offer
        const offer = await peerConnectionRef.current.createOffer({
          offerToReceiveVideo: true,
          offerToReceiveAudio: false
        });
        await peerConnectionRef.current.setLocalDescription(offer);

        if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
          websocketRef.current.send(JSON.stringify({
            type: 'offer',
            sdp: offer.sdp
          }));
          addLog('WebRTC offer sent');
        } else {
          throw new Error('WebSocket not connected');
        }
      }

      setIsStreaming(true);
      addLog('Stream started successfully');
    } catch (error) {
      console.error('Error starting stream:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      setError(`Failed to start stream: ${errorMsg}`);
      addLog(`Failed to start stream: ${errorMsg}`);
    }
  };

  const stopStream = () => {
    try {
      addLog('Stopping stream...');
      
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          track.stop();
        });
        localStreamRef.current = null;
      }

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }

      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      if (websocketRef.current) {
        websocketRef.current.close();
        websocketRef.current = null;
      }

      if (performanceIntervalRef.current) {
        clearInterval(performanceIntervalRef.current);
        performanceIntervalRef.current = null;
      }

      setIsStreaming(false);
      setConnectionStatus('disconnected');
      setPerformanceData(null);
      addLog('Stream stopped');
    } catch (error) {
      console.error('Error stopping stream:', error);
      addLog('Error stopping stream');
    }
  };

  const handleMessage = async (message: any) => {
    if (!peerConnectionRef.current) return;

    try {
      switch (message.type) {
        case 'answer':
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription({
              type: 'answer',
              sdp: message.sdp
            })
          );
          addLog('WebRTC answer received and processed');
          break;

        case 'ice-candidate':
          if (message.candidate) {
            await peerConnectionRef.current.addIceCandidate(
              new RTCIceCandidate(message.candidate)
            );
          }
          break;

        default:
          console.log('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error handling message:', error);
      addLog('Error processing WebRTC message');
    }
  };

  useEffect(() => {
    initializeWebRTC();

    return () => {
      stopStream();
    };
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'connecting':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return '🟢';
      case 'connecting':
        return '🟡';
      case 'error':
        return '🔴';
      default:
        return '⚫';
    }
  };

  const getFpsColor = (fps: number) => {
    if (fps >= 25) return 'text-green-600';
    if (fps >= 15) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2 flex items-center justify-center gap-3">
            🎯 Carter Island - GPU YOLO Detection
          </h1>
          <p className="text-gray-600 text-lg">
            Real-time object detection with NVIDIA GPU acceleration
          </p>
        </div>

        {/* Status Bar */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`px-4 py-2 rounded-lg border text-sm font-medium ${getStatusColor(connectionStatus)}`}>
                {getStatusIcon(connectionStatus)} Status: {connectionStatus}
              </div>
              
              {performanceData && (
                <>
                  <div className="px-3 py-2 bg-blue-50 rounded-lg border border-blue-200">
                    <span className="text-blue-800 font-medium">
                      📱 Device: {performanceData.device}
                    </span>
                  </div>
                  
                  {performanceData.cuda_available && (
                    <div className="px-3 py-2 bg-green-50 rounded-lg border border-green-200">
                      <span className="text-green-800 font-medium">⚡ CUDA Enabled</span>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={startStream}
                disabled={isStreaming || connectionStatus !== 'connected'}
                className="px-6 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white rounded-lg font-medium transition-all duration-200 flex items-center gap-2 shadow-md hover:shadow-lg"
              >
                📹 {isStreaming ? 'Streaming...' : 'Start Stream'}
              </button>
              <button
                onClick={stopStream}
                disabled={!isStreaming}
                className="px-6 py-2 bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white rounded-lg font-medium transition-all duration-200 flex items-center gap-2 shadow-md hover:shadow-lg"
              >
                ⏹️ Stop Stream
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm flex items-center gap-2">
                ⚠️ {error}
              </p>
            </div>
          )}
        </div>

        {/* Performance Dashboard */}
        {performanceData && isStreaming && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              📊 Real-time Performance Monitor
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
                <p className={`text-3xl font-bold ${getFpsColor(performanceData.fps)}`}>
                  {performanceData.fps.toFixed(1)}
                </p>
                <p className="text-sm text-gray-600 font-medium">Render FPS</p>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                <p className={`text-3xl font-bold ${getFpsColor(performanceData.inference_fps)}`}>
                  {performanceData.inference_fps.toFixed(1)}
                </p>
                <p className="text-sm text-gray-600 font-medium">Inference FPS</p>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg">
                <p className="text-3xl font-bold text-purple-600">
                  {performanceData.active_connections}
                </p>
                <p className="text-sm text-gray-600 font-medium">Connections</p>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg">
                <p className="text-3xl font-bold text-yellow-600">
                  {performanceData.model_loaded ? '✅' : '❌'}
                </p>
                <p className="text-sm text-gray-600 font-medium">Model Status</p>
              </div>
            </div>
          </div>
        )}

        {/* Model Information */}
        {modelInfo && modelInfo.model_loaded && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              🤖 Model Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Status</p>
                <p className="font-medium text-green-600">✅ Model Loaded</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Device</p>
                <p className="font-medium">{modelInfo.device || 'Unknown'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Classes</p>
                <p className="font-medium">{modelInfo.num_classes || 0} classes</p>
              </div>
            </div>
            {modelInfo.classes && (
              <div>
                <p className="text-sm text-gray-600 mb-3">Detected Classes:</p>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {Object.entries(modelInfo.classes).map(([id, className]) => (
                    <span 
                      key={id}
                      className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium"
                    >
                      {className}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Video Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
          {/* Local Video */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-3">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                📷 Local Camera
              </h3>
            </div>
            <div className="p-4">
              <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                {!isStreaming && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center text-white">
                      <div className="text-4xl mb-2">📷</div>
                      <p className="text-lg">Camera Off</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Processed Video */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="bg-gradient-to-r from-green-500 to-green-600 px-4 py-3">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                🎯 YOLO Detection
              </h3>
            </div>
            <div className="p-4">
              <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                {!isStreaming && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center text-white">
                      <div className="text-4xl mb-2">🎯</div>
                      <p className="text-lg">No Detection Stream</p>
                    </div>
                  </div>
                )}
                {isStreaming && (
                  <div className="absolute top-2 left-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-xs">
                    Live Detection
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* System Logs */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-4 py-3">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                📋 System Logs
              </h3>
            </div>
            <div className="p-4">
              <div className="bg-gray-900 rounded-lg p-3 h-64 overflow-y-auto">
                <div className="space-y-1 text-sm font-mono">
                  {logs.length > 0 ? logs.map((log, index) => (
                    <div key={index} className="text-green-400">
                      {log}
                    </div>
                  )) : (
                    <div className="text-gray-500">No logs yet...</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            📖 Instructions & Tips
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-sm text-gray-600">
            <div>
              <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                🚀 Getting Started
              </h4>
              <ol className="list-decimal list-inside space-y-2">
                <li>Ensure backend is running with CUDA support</li>
                <li>Allow camera permissions when prompted</li>
                <li>Click "Start Stream" to begin detection</li>
                <li>Monitor real-time performance metrics</li>
              </ol>
            </div>
            <div>
              <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                ⚡ Performance Optimization
              </h4>
              <ul className="list-disc list-inside space-y-2">
                <li>GPU acceleration automatically enabled</li>
                <li>Optimized frame processing pipeline</li>
                <li>Adaptive inference frame skipping</li>
                <li>Multi-threaded processing</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                🔧 Troubleshooting
              </h4>
              <ul className="list-disc list-inside space-y-2">
                <li>Check CUDA installation for GPU support</li>
                <li>Verify backend health at <code className="bg-gray-100 px-1 rounded text-xs">localhost:8000</code></li>
                <li>Monitor system logs for errors</li>
                <li>Restart if FPS drops significantly</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}