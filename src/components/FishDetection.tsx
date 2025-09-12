'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react'
import YoloModel from './models/Yolo'

interface Detection {
  bbox: number[]
  score: number
  class: string
  className: string
}

const FishDetection: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [model, setModel] = useState<YoloModel | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [detections, setDetections] = useState<Detection[]>([])
  const [isDetecting, setIsDetecting] = useState(false)
  const animationFrameRef = useRef<number | null>(null)

  // Load model saat component mount
  useEffect(() => {
    const loadModel = async () => {
      try {
        setIsLoading(true)
        const yoloModel = new YoloModel()
        await yoloModel.loadModel('/models/fish-detection.onnx') // ganti dengan nama model Anda
        setModel(yoloModel)
        console.log('Model loaded successfully!')
      } catch (error) {
        console.error('Error loading model:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadModel()
  }, [])

  // Setup camera
  useEffect(() => {
    const setupCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: 640, 
            height: 480,
            facingMode: 'environment' // untuk kamera belakang di mobile
          } 
        })
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      } catch (error) {
        console.error('Error accessing camera:', error)
      }
    }

    setupCamera()
  }, [])

  // Function untuk menjalankan deteksi
  const runDetection = useCallback(async () => {
    if (!model || !videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')!

    // Set canvas size sama dengan video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Draw video frame ke canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Get image data untuk model
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

    try {
      // Run inference
      const predictions = await model.predict(imageData)
      setDetections(predictions)

      // Draw bounding boxes
      drawDetections(ctx, predictions)

      // Simpan hasil ke database jika ada deteksi
      if (predictions.length > 0) {
        await saveDetectionResults(predictions)
      }

    } catch (error) {
      console.error('Detection error:', error)
    }

    // Continue detection loop jika masih aktif
    if (isDetecting) {
      animationFrameRef.current = requestAnimationFrame(runDetection)
    }
  }, [model, isDetecting])

  // Function untuk menggambar bounding box
  const drawDetections = (ctx: CanvasRenderingContext2D, predictions: Detection[]) => {
    predictions.forEach(detection => {
      const [x, y, width, height] = detection.bbox

      // Draw bounding box
      ctx.strokeStyle = '#00ff00'
      ctx.lineWidth = 2
      ctx.strokeRect(x, y, width, height)

      // Draw label
      ctx.fillStyle = '#00ff00'
      ctx.font = '16px Arial'
      const label = `${detection.className}: ${(detection.score * 100).toFixed(1)}%`
      ctx.fillText(label, x, y - 5)
    })
  }

    // Function untuk menyimpan hasil ke database
    const saveDetectionResults = async (predictions: Detection[]) => {
        try {
            const detectionData = {
            timestamp: new Date().toISOString(),
            fishCount: predictions.length,
            detections: predictions.map(p => ({
                fishName: p.className,
                confidence: p.score,
                bbox: p.bbox
            }))
            }

            console.log('Saving detection to database...', detectionData)

            const response = await fetch('/api/detection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(detectionData)
            })

            const result = await response.json()
            
            if (response.ok) {
            console.log('Detection saved successfully:', result)
            } else {
            console.error('Failed to save detection:', result)
            }
            
        } catch (error) {
            console.error('Error saving detection:', error)
        }
    }

  // Start/Stop detection
  const toggleDetection = () => {
    setIsDetecting(!isDetecting)
  }

  // Start detection loop
  useEffect(() => {
    if (isDetecting && model) {
      runDetection()
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isDetecting, runDetection])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4">Loading AI Model...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Deteksi Ikan Real-time</h2>
        
        <div className="relative">
          {/* Video Stream */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full rounded-lg"
            style={{ display: isDetecting ? 'none' : 'block' }}
          />
          
          {/* Canvas untuk deteksi */}
          <canvas
            ref={canvasRef}
            className="w-full rounded-lg"
            style={{ display: isDetecting ? 'block' : 'none' }}
          />
        </div>

        <div className="mt-4 flex justify-between items-center">
          <button
            onClick={toggleDetection}
            disabled={!model}
            className={`px-6 py-2 rounded-lg font-semibold ${
              isDetecting 
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            } disabled:opacity-50`}
          >
            {isDetecting ? 'Stop Detection' : 'Start Detection'}
          </button>

          <div className="text-sm text-gray-600">
            Deteksi: {detections.length} ikan
          </div>
        </div>

        {/* Hasil deteksi */}
        {detections.length > 0 && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold mb-2">Hasil Deteksi:</h3>
            {detections.map((detection, index) => (
              <div key={index} className="flex justify-between items-center py-1">
                <span>{detection.className}</span>
                <span className="text-sm text-gray-600">
                  {(detection.score * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default FishDetection