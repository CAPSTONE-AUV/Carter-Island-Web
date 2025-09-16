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
  
  const [isClient, setIsClient] = useState(false);
  const [clientId, setClientId] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connected' | 'error'>('disconnected');
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const websocketRef = useRef<WebSocket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const performanceIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize client-only code
  useEffect(() => {
    setIsClient(true);
    setClientId(Math.random().toString(36).substring(7));
  }, []);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 9)]);
  }, []);

  // Fetch model info
  useEffect(() => {
    if (!isClient) return;
    
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
        addLog('Failed to fetch model info');
      }
    };
    
    fetchModelInfo();
  }, [apiUrl, addLog, isClient]);

  // Performance monitoring
  useEffect(() => {
    if (!isClient) return;
    
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
  }, [apiUrl, isStreaming, isClient]);

  const initializeWebRTC = async () => {
    if (!isClient || !clientId) return;
    
    try {
      setConnectionStatus('disconnected');
      addLog('Initializing WebRTC connection...');
      
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
        addLog('WebSocket connection failed');
      };

      websocketRef.current.onclose = (event) => {
        setConnectionStatus('disconnected');
        addLog(`WebSocket closed: ${event.code}`);
      };

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
      addLog('Failed to initialize WebRTC');
    }
  };

  const startStream = async () => {
    try {
      addLog('Starting camera stream...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 60 },
          facingMode: 'environment'
        },
        audio: false
      });

      localStreamRef.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        addLog(`Camera resolution: ${stream.getVideoTracks()[0].getSettings().width}x${stream.getVideoTracks()[0].getSettings().height}`);
      }

      if (peerConnectionRef.current) {
        stream.getTracks().forEach(track => {
          peerConnectionRef.current!.addTrack(track, stream);
        });

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
    if (isClient && clientId) {
      initializeWebRTC();

      return () => {
        stopStream();
      };
    }
  }, [isClient, clientId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'error':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getStatusIndicator = (status: string) => {
    switch (status) {
      case 'connected':
        return <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>;
      case 'error':
        return <div className="w-2 h-2 bg-red-500 rounded-full"></div>;
      default:
        return <div className="w-2 h-2 bg-slate-400 rounded-full"></div>;
    }
  };

  const getFpsColor = (fps: number) => {
    if (fps >= 25) return 'text-emerald-600';
    if (fps >= 15) return 'text-amber-600';
    return 'text-red-600';
  };

  // Early return for SSR
  if (!isClient) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <h1 className="text-3xl font-light text-slate-900 mb-2">
              Carter Island Detection System
            </h1>
            <p className="text-slate-600">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-light text-slate-900 mb-2">
            Carter Island Detection System
          </h1>
          <p className="text-slate-600">
            Real-time object detection with GPU acceleration
          </p>
        </div>

        {/* Status Bar */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`px-4 py-2 rounded-lg border text-sm font-medium flex items-center gap-2 ${getStatusColor(connectionStatus)}`}>
                {getStatusIndicator(connectionStatus)}
                Status: {connectionStatus === 'error' ? 'websocket error' : connectionStatus}
              </div>
              
              {performanceData && (
                <>
                  <div className="px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-700 text-sm font-medium">
                      Device: {performanceData.device}
                    </span>
                  </div>
                  
                  {performanceData.cuda_available && (
                    <div className="px-3 py-2 bg-emerald-50 rounded-lg border border-emerald-200">
                      <span className="text-emerald-700 text-sm font-medium">CUDA Enabled</span>
                    </div>
                  )}
                </>
              )}
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all duration-200 text-sm"
              >
                Refresh
              </button>
              <button
                onClick={startStream}
                disabled={isStreaming || connectionStatus !== 'connected'}
                className="px-6 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-lg font-medium transition-all duration-200 text-sm"
              >
                {isStreaming ? 'Streaming...' : 'Start Stream'}
              </button>
              <button
                onClick={stopStream}
                disabled={!isStreaming}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-400 text-white rounded-lg font-medium transition-all duration-200 text-sm"
              >
                Stop Stream
              </button>
            </div>
          </div>
        </div>

        {/* Model Information - Compact Single Row */}
        {modelInfo && modelInfo.model_loaded && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h3 className="text-lg font-medium text-slate-900">
                Model Information
              </h3>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600">Status:</span>
                  <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded text-sm font-medium">
                    Model Loaded
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600">Device:</span>
                  <span className="px-2 py-1 bg-slate-50 text-slate-700 rounded text-sm font-medium">
                    {modelInfo.device || 'Unknown'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600">Classes:</span>
                  <span className="px-2 py-1 bg-slate-50 text-slate-700 rounded text-sm font-medium">
                    {modelInfo.num_classes || 0} classes
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Video Grid - 2 Videos Only */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Local Video */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="border-b border-slate-200 px-4 py-3">
              <h3 className="text-md font-medium text-slate-900">
                Live Camera
              </h3>
            </div>
            <div className="p-4">
              <div className="relative bg-slate-900 rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                {!isStreaming && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center text-slate-400">
                      <div className="text-2xl mb-2">Camera</div>
                      <p className="text-sm">Not Active</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* YOLO Detection Video */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="border-b border-slate-200 px-4 py-3">
              <h3 className="text-md font-medium text-slate-900">
                YOLO Detection
              </h3>
            </div>
            <div className="p-4">
              <div className="relative bg-slate-900 rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                {!isStreaming && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center text-slate-400">
                      <div className="text-2xl mb-2">YOLO</div>
                      <p className="text-sm">No Stream</p>
                    </div>
                  </div>
                )}
                {isStreaming && (
                  <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded text-xs font-medium">
                    LIVE
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* System Logs */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3">
            <h3 className="text-md font-medium text-slate-900">
              System Logs
            </h3>
          </div>
          <div className="p-4">
            <div className="bg-slate-900 rounded-lg p-4 h-40 overflow-y-auto">
              <div className="space-y-1 text-sm font-mono">
                {logs.length > 0 ? logs.map((log, index) => (
                  <div key={index} className="text-emerald-400">
                    {log}
                  </div>
                )) : (
                  <div className="text-slate-500">No logs available</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Performance Dashboard - Moved Below Logs */}
        {performanceData && isStreaming && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-medium text-slate-900 mb-4">
              Performance Monitor
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-slate-50 rounded-lg">
                <p className={`text-3xl font-light ${getFpsColor(performanceData.fps)}`}>
                  {performanceData.fps.toFixed(1)}
                </p>
                <p className="text-sm text-slate-600 mt-1">Render FPS</p>
              </div>
              <div className="text-center p-4 bg-slate-50 rounded-lg">
                <p className={`text-3xl font-light ${getFpsColor(performanceData.inference_fps)}`}>
                  {performanceData.inference_fps.toFixed(1)}
                </p>
                <p className="text-sm text-slate-600 mt-1">Inference FPS</p>
              </div>
              <div className="text-center p-4 bg-slate-50 rounded-lg">
                <p className="text-3xl font-light text-slate-700">
                  {performanceData.active_connections}
                </p>
                <p className="text-sm text-slate-600 mt-1">Connections</p>
              </div>
              <div className="text-center p-4 bg-slate-50 rounded-lg">
                <p className="text-3xl font-light text-slate-700">
                  {performanceData.model_loaded ? 'Active' : 'Inactive'}
                </p>
                <p className="text-sm text-slate-600 mt-1">Model Status</p>
              </div>
            </div>
          </div>
        )}

        {/* Troubleshooting Only */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-medium text-slate-900 mb-4">
            Troubleshooting
          </h3>
          <div className="text-sm text-slate-600">
            <ul className="list-disc list-inside space-y-2">
              <li>Check CUDA installation for GPU support</li>
              <li>Verify backend health at localhost:8000</li>
              <li>Monitor system logs for errors</li>
              <li>Restart if FPS drops significantly</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}