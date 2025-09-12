// src/app/dashboard/stream/page.tsx (atau lokasi file stream yang ada)
'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import YoloModel from '@/components/models/Yolo'
import Header from '@/components/layout/Header'

// Interface untuk type definitions
interface Detection {
  bbox: number[]
  score: number
  class: string
  className: string
}

export default function LiveStreamPage() {
  const [streamStatus, setStreamStatus] = useState<'online' | 'offline'>('offline')
  const [viewerCount, setViewerCount] = useState<number>(0)
  const [model, setModel] = useState<YoloModel | null>(null)
  const [isDetectionEnabled, setIsDetectionEnabled] = useState<boolean>(false)
  const [detections, setDetections] = useState<Detection[]>([])
  const [isLoadingModel, setIsLoadingModel] = useState<boolean>(false)
  const [modelStatus, setModelStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [detectionFPS, setDetectionFPS] = useState(10)
  const [isProcessing, setIsProcessing] = useState(false)
  const [avgProcessingTime, setAvgProcessingTime] = useState(0)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number | undefined>(undefined)

  // Load YOLOv8 model saat component mount
  useEffect(() => {
    const loadModel = async () => {
      try {
        setIsLoadingModel(true)
        setModelStatus('loading')
        
        const yoloModel = new YoloModel()
        
        // Show progress during model load
        console.log('Loading ONNX model...')
        await yoloModel.loadModel('/models/fish-detection.onnx')
        
        // Warm up model dengan dummy inference
        console.log('Warming up model...')
        const dummyImageData = new ImageData(640, 640)
        await yoloModel.predict(dummyImageData) // Dummy run
        
        setModel(yoloModel)
        setModelStatus('ready')
        console.log('Model ready for detection!')
        
      } catch (error) {
        console.error('Model loading failed:', error)
        setModelStatus('error')
      } finally {
        setIsLoadingModel(false)
      }
    }

    loadModel()
  }, [])

  // Setup camera stream
  useEffect(() => {
    const setupCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: 1920, 
            height: 1080,
            facingMode: 'environment'
          } 
        })
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          setStreamStatus('online') // Update stream status
        }
      } catch (error) {
        console.error('Error accessing camera:', error)
        setStreamStatus('offline')
      }
    }

    setupCamera()
  }, [])

  // Fish detection loop dengan proper error handling
  const runDetection = useCallback(async (): Promise<void> => {
    if (!model || !videoRef.current || !canvasRef.current || !isDetectionEnabled || isProcessing) return

    const startTime = performance.now() // TAMBAHKAN: Start timing

    setIsProcessing(true)

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      setIsProcessing(false)
      return
    }

    try {
      // Use smaller resolution for inference (faster processing)
      const inferenceSize = 640 // Reduce from 640 to 416 for better performance
      
      // Create offscreen canvas for inference
      const offscreenCanvas = new OffscreenCanvas(inferenceSize, inferenceSize)
      const offscreenCtx = offscreenCanvas.getContext('2d')
      
      if (!offscreenCtx) return

      // Draw video to small canvas
      offscreenCtx.drawImage(video, 0, 0, inferenceSize, inferenceSize)
      const imageData = offscreenCtx.getImageData(0, 0, inferenceSize, inferenceSize)

      // Run inference
      const predictions = await model.predict(imageData)
      
      // Update UI
      setDetections(predictions)
      
      // Update display canvas
      const rect = video.getBoundingClientRect()
      canvas.width = rect.width
      canvas.height = rect.height
      
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      // Scale predictions back to display size
      predictions.forEach((detection) => {
        const scaleX = canvas.width / inferenceSize
        const scaleY = canvas.height / inferenceSize
        
        const [x, y, width, height] = detection.bbox
        const scaledX = x * scaleX
        const scaledY = y * scaleY
        const scaledWidth = width * scaleX
        const scaledHeight = height * scaleY

        // Draw bounding box
        ctx.strokeStyle = '#00ff00'
        ctx.lineWidth = 2
        ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight)

        // Draw label
        ctx.fillStyle = 'rgba(0, 255, 0, 0.9)'
        ctx.fillRect(scaledX, scaledY - 20, 100, 20)

        ctx.fillStyle = '#000'
        ctx.font = '12px Arial'
        ctx.fillText(`ikan: ${(detection.score * 100).toFixed(0)}%`, scaledX + 2, scaledY - 6)
      })

      if (predictions.length > 0) {
        // Save to database (non-blocking)
        saveDetectionResults(predictions).catch(console.error)
      }

    } catch (error) {
      console.error('Detection error:', error)
    } finally {
      setIsProcessing(false)
    }

    // TAMBAHKAN: Performance monitoring dan adaptive FPS
    const endTime = performance.now()
    const processingTime = endTime - startTime
    
    // Update average processing time
    setAvgProcessingTime(prev => (prev + processingTime) / 2)
    
    // Adaptive FPS based on processing time
    let adaptiveFPS = detectionFPS
    if (processingTime > 1000) { // If taking more than 1 second
      adaptiveFPS = Math.max(1, detectionFPS - 1) // Reduce FPS
    } else if (processingTime < 200) { // If very fast
      adaptiveFPS = Math.min(5, detectionFPS + 1) // Increase FPS
    }

    // Continue with adaptive timing
    if (isDetectionEnabled) {
      const delay = 1000 / adaptiveFPS
      setTimeout(() => {
        if (isDetectionEnabled) {
          animationFrameRef.current = requestAnimationFrame(runDetection)
        }
      }, delay)
    }
  }, [model, isDetectionEnabled, isProcessing, detectionFPS]) // TAMBAHKAN avgProcessingTime ke dependencies

  // Save detection ke database
  const saveDetectionResults = async (predictions: Detection[]): Promise<void> => {
    try {
      const detectionData = {
        timestamp: new Date().toISOString(),
        fishCount: predictions.length,
        detections: predictions.map((p: Detection) => ({ 
          fishName: p.className,
          confidence: p.score,
          bbox: p.bbox
        }))
      }

      await fetch('/api/detection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(detectionData)
      })
    } catch (error) {
      console.error('Error saving detection:', error)
    }
  }

  // Toggle detection
  const toggleDetection = () => {
    setIsDetectionEnabled(!isDetectionEnabled)
  }

  // Start detection loop
  useEffect(() => {
    if (isDetectionEnabled && model) {
      runDetection()
    }
    
    return () => {
      if (animationFrameRef.current !== undefined) { 
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isDetectionEnabled, runDetection])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - gunakan yang existing */}
      <Header 
        title="Live Underwater Camera Feed" 
        subtitle="Real-time underwater feed with AI detection" 
        emoji="🌊"
      >
        <style jsx global>{`
          .flex.items-center.space-x-6 > .flex.items-center.space-x-3 {
            display: none !important;
          }
        `}</style>

        {/* Status di kanan tetap ada */}
        {/* YOLOv8 Status */}
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">AI Detection:</span>
          <span
            className={`text-sm font-medium ${
              isDetectionEnabled ? 'text-green-600' : 'text-gray-600'
            }`}
          >
            {isLoadingModel ? 'Loading...' : isDetectionEnabled ? 'Active' : 'Inactive'}
          </span>
          <div
            className={`w-2 h-2 rounded-full ${
              isDetectionEnabled ? 'bg-green-500' : 'bg-gray-400'
            }`}
          ></div>
        </div>

        {/* Stream Status */}
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">Stream:</span>
          <span
            className={`text-sm font-medium ${
              streamStatus === 'online' ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {streamStatus === 'online' ? 'Online' : 'Offline'}
          </span>
          <div
            className={`w-2 h-2 rounded-full ${
              streamStatus === 'online' ? 'bg-green-500' : 'bg-red-500'
            }`}
          ></div>
        </div>
      </Header>


      <div className="p-0 lg:px-4 mt-4">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Live Feed - Main Content */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-4 border-b flex justify-between items-center">
                <h2 className="text-lg font-semibold">Live Feed</h2>
                <button
                  onClick={toggleDetection}
                  disabled={!model || isLoadingModel}
                  className={`px-4 py-2 rounded text-white font-medium disabled:opacity-50 ${
                    isDetectionEnabled 
                      ? 'bg-red-500 hover:bg-red-600' 
                      : 'bg-green-500 hover:bg-green-600'
                  }`}
                >
                  {isDetectionEnabled ? 'Stop AI Detection' : 'Start AI Detection'}
                </button>
              </div>
              
            <div className="relative bg-gray-900 rounded-lg overflow-hidden" style={{height: '500px'}}>
              {/* Video Stream - SELALU tampil sebagai background */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover" // Always show
              />
              
              {/* Canvas untuk detection overlay - TRANSPARANT di atas video */}
              <canvas
                ref={canvasRef}
                className={`absolute inset-0 w-full h-full object-cover ${isDetectionEnabled ? 'block' : 'hidden'}`}
                style={{pointerEvents: 'none'}} // Allow clicks to pass through
              />
              
              {/* Overlay controls */}
              <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center">
                <div className="bg-black bg-opacity-50 text-white px-3 py-1 rounded text-sm">
                  Resolution: 1920x1080 | Detection FPS: {detectionFPS} | Fish: {detections.length}
                </div>
                <div className="space-x-2">
                  <button
                    onClick={toggleDetection}
                    disabled={!model || isLoadingModel}
                    className={`px-4 py-2 rounded text-white font-medium disabled:opacity-50 ${
                      isDetectionEnabled 
                        ? 'bg-red-500 hover:bg-red-600' 
                        : 'bg-green-500 hover:bg-green-600'
                    }`}
                  >
                    {isDetectionEnabled ? 'Stop AI Detection' : 'Start AI Detection'}
                  </button>
                </div>
              </div>
            </div>
            </div>
          </div>

          {/* Sidebar - Stream Stats & Detection Results */}
          <div className="space-y-6">
            
            {/* Stream Status - yang existing */}
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-4 border-b">
                <h3 className="font-semibold flex items-center">
                  📊 Stream Status
                </h3>
              </div>
              <div className="p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Status:</span>
                  <span className={`text-sm font-medium ${streamStatus === 'online' ? 'text-green-600' : 'text-red-600'}`}>
                    {streamStatus === 'online' ? 'Online' : 'Offline'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Viewers:</span>
                  <span className="text-sm">{viewerCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Duration:</span>
                  <span className="text-sm">--:--:--</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Quality:</span>
                  <span className="text-sm">HD 1080p</span>
                </div>
              </div>
            </div>

            {/* Fish Detection Results - BARU */}
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-4 border-b">
                <h3 className="font-semibold flex items-center">
                  🐟 Fish Detection
                </h3>
              </div>
              <div className="p-4">
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">AI Status:</span>
                    <span className={`text-sm font-medium ${isDetectionEnabled ? 'text-green-600' : 'text-gray-600'}`}>
                      {isDetectionEnabled ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Fish Count:</span>
                    <span className="text-sm font-medium text-blue-600">{detections.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Avg Processing:</span>
                    <span className="text-sm text-gray-500">{avgProcessingTime.toFixed(0)}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Detection FPS:</span>
                    <span className="text-sm text-gray-500">{detectionFPS}</span>
                  </div>
                </div>

                <div className="mb-4 border-t pt-4">
                  <label className="text-sm text-gray-600 mb-2 block">Detection Speed: {detectionFPS} FPS</label>
                  <input
                    type="range"
                    min="1"
                    max="15"
                    value={detectionFPS}
                    onChange={(e) => setDetectionFPS(Number(e.target.value))}
                    className="w-full"
                    disabled={isDetectionEnabled} // Disable saat detection running
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>1 FPS</span>
                    <span>15 FPS</span>
                  </div>
                </div>

                {/* Recent Detections */}
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium mb-2">Recent Detections:</h4>
                  {detections.length === 0 ? (
                    <p className="text-xs text-gray-500">No fish detected</p>
                  ) : (
                    <div className="space-y-1">
                      {detections.slice(0, 5).map((fish: Detection, index: number) => (
                        <div key={index} className="flex justify-between text-xs">
                          <span>{fish.className}</span>
                          <span className="text-gray-500">{(fish.score * 100).toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}