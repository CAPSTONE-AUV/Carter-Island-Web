'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Circle, Square, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'

interface RecordingControlsProps {
  isStreaming: boolean
  videoElement: HTMLVideoElement | null
  originalStream?: MediaStream | null 
  onUploadComplete?: (filename: string) => void
}

export default function RecordingControls({ 
  isStreaming, 
  videoElement,
  originalStream,
  onUploadComplete 
}: RecordingControlsProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [autoRecord, setAutoRecord] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  const startRecording = useCallback(async () => {
    console.log('=== RECORDING DEBUG START ===')
    console.log('originalStream:', originalStream)
    console.log('videoElement:', videoElement)
    console.log('videoElement.srcObject:', videoElement?.srcObject)

    //DEBUG CODE DI SINI
    if (originalStream) {
      console.log('originalStream tracks:', originalStream.getTracks())
      originalStream.getTracks().forEach((track, i) => {
        console.log(`originalStream track ${i}:`, {
          kind: track.kind,
          enabled: track.enabled,
          readyState: track.readyState,
          label: track.label
        })
      })
    }

    if (videoElement?.srcObject instanceof MediaStream) {
      const videoStream = videoElement.srcObject
      console.log('videoElement stream tracks:', videoStream.getTracks())
      videoStream.getTracks().forEach((track, i) => {
        console.log(`videoElement track ${i}:`, {
          kind: track.kind,
          enabled: track.enabled,
          readyState: track.readyState,
          label: track.label
        })
      })
    }

    // Test record dari kedua stream
    const streams = [
      { name: 'originalStream', stream: originalStream },
      { name: 'videoElement.srcObject', stream: videoElement?.srcObject }
    ]

    for (const {name, stream} of streams) {
      if (stream instanceof MediaStream) {
        console.log(`Testing ${name}:`)
        
        // Test apakah stream ini bisa buat MediaRecorder
        try {
          const testRecorder = new MediaRecorder(stream)
          console.log(`✅ ${name} compatible with MediaRecorder`)
          testRecorder.start()
          setTimeout(() => testRecorder.stop(), 100)
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e)
          console.log(`❌ ${name} NOT compatible:`, message)
        }
      }
    }
    // AKHIR DEBUG CODE
    
    if (!isStreaming) {
      toast.error('Video stream tidak tersedia')
      return
    }

    try {
      setIsRecording(true)

      let recordStream: MediaStream | null = null
      
      // Prioritas 1: Gunakan originalStream jika ada
      if (originalStream && originalStream.getTracks().length > 0) {
        console.log('Using originalStream from props')
        recordStream = originalStream.clone()
      }
      // Prioritas 2: Fallback ke videoElement.srcObject
      else if (videoElement?.srcObject instanceof MediaStream) {
        console.log('Using MediaStream from video element')
        recordStream = videoElement.srcObject.clone()
      } 
      else {
        throw new Error('No MediaStream available for recording')
      }

      console.log('Recording stream tracks:', recordStream.getTracks())
      
      // Pastikan ada video track
      const videoTracks = recordStream.getVideoTracks()
      if (videoTracks.length === 0) {
        throw new Error('No video tracks available in stream')
      }

      console.log('Video tracks found:', videoTracks.length)
      videoTracks.forEach((track, i) => {
        console.log(`Video track ${i}:`, track.label, track.readyState, track.enabled)
      })

      // Setup MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8') 
        ? 'video/webm;codecs=vp8' 
        : 'video/webm'

      console.log('Using mimeType:', mimeType)

      mediaRecorderRef.current = new MediaRecorder(recordStream, { 
        mimeType,
        videoBitsPerSecond: 2500000
      })

      recordedChunksRef.current = []

      mediaRecorderRef.current.ondataavailable = (event) => {
        console.log('📦 Data chunk received, size:', event.data.size)
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data)
        }
      }

      mediaRecorderRef.current.onstop = () => {
        console.log('⏹️ Recording stopped, chunks:', recordedChunksRef.current.length)
        setTimeout(() => uploadRecording(), 200)
      }

      mediaRecorderRef.current.onerror = (event) => {
        console.error('🚨 MediaRecorder error:', event)
        setIsRecording(false)
        toast.error('Recording error occurred')
      }

      mediaRecorderRef.current.start(1000)
      toast.success('Recording dimulai')

    } catch (error) {
      console.error('❌ Error starting recording:', error)
      setIsRecording(false)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      toast.error(`Gagal memulai recording: ${errorMessage}`)
    }
  }, [isStreaming, originalStream, videoElement])

  // Auto-start recording when streaming starts (if enabled)
  const handleAutoRecord = useCallback(() => {
    if (autoRecord && isStreaming && !isRecording) {
      startRecording()
    }
  }, [autoRecord, isStreaming, isRecording])

  // Ganti kedua useEffect jadi satu
  useEffect(() => {
    if (autoRecord && isStreaming && !isRecording) {
      toast.info('Auto-record akan dimulai dalam 3 detik...')
      
      setTimeout(() => {
        if (isStreaming && !isRecording) {
          startRecording()
        }
      }, 3000)
    }
  }, [autoRecord, isStreaming, isRecording, startRecording])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      console.log('⏹️  Stopping recording, current state:', mediaRecorderRef.current.state)
      console.log('⏹️  Chunks before stop:', recordedChunksRef.current.length)
      
      // Request final data before stopping
      if (mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.requestData()
        
        setTimeout(() => {
          if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop()
          }
        }, 100)
      }
      
      setIsRecording(false)
      toast.success('Recording dihentikan')
    }
  }, [isRecording])

  const uploadRecording = async () => {
    console.log('📤 Upload called, chunks:', recordedChunksRef.current.length)
    
    // Log semua chunks
    recordedChunksRef.current.forEach((chunk, i) => {
      console.log(`Chunk ${i}: ${chunk.size} bytes, type: ${chunk.type}`)
    })
    
    if (recordedChunksRef.current.length === 0) {
      console.error('❌ No chunks available')
      toast.error('Tidak ada data recording - coba record lebih lama')
      return
    }

    setIsUploading(true)
    try {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' })
      console.log('📦 Final blob size:', blob.size)
      
      if (blob.size < 100) {
        throw new Error(`Blob too small: ${blob.size} bytes`)
      }

      // Test blob validity
      const url = URL.createObjectURL(blob)
      console.log('📹 Blob URL created:', url)
      
      const filename = `recording_${new Date().toISOString().replace(/[:.]/g, '-')}.webm`
      
      const formData = new FormData()
      formData.append('file', blob, filename)

      const response = await fetch('http://localhost:8000/api/recordings', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Upload failed: ${response.status} - ${errorText}`)
      }

      const result = await response.json()
      console.log('✅ Upload success:', result)
      toast.success(`Recording berhasil disimpan: ${result.filename}`)
      onUploadComplete?.(result.filename)

      // Cleanup
      URL.revokeObjectURL(url)

      } catch (error) {
      console.error('❌ Upload error:', error)
      // Fix TypeScript error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      toast.error(`Gagal upload: ${errorMessage}`)
      } finally {
      setIsUploading(false)
      }
  }

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/* Record Button */}
        <Button
        size="sm"
        onClick={toggleRecording}
        disabled={!isStreaming || isUploading}
        variant={isRecording ? "destructive" : "secondary"}
        className="flex items-center gap-2 min-w-[100px]"
        >
        {isRecording ? (
            <>
            <Square className="h-3 w-3" />
            Stop
            </>
        ) : (
            <>
            <Circle className="h-3 w-3 fill-current" />
            Rec
            </>
        )}
        </Button>

      {/* Auto Record Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="w-8 h-8 p-0">
            <ChevronDown className="h-3 w-3" />
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
            <label className="flex items-center space-x-2 cursor-pointer px-2 py-1">
                <Checkbox 
                checked={autoRecord}
                onCheckedChange={(v) => setAutoRecord(v === true)}
                />
                <span>Always auto-record stream</span>
            </label>
            </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {isUploading && (
        <span className="text-sm text-muted-foreground">
          Uploading...
        </span>
      )}
    </div>
  )
}