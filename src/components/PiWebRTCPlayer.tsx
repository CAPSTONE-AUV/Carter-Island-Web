'use client'
import { useEffect, useRef, useState } from 'react'

const WS_URL = process.env.NEXT_PUBLIC_PI_WS ?? 'ws://192.168.2.2:8765/ws'

export default function PiWebRTCPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const [status, setStatus] = useState<'idle'|'connecting'|'playing'|'error'>('idle')

  useEffect(() => {
    const start = async () => {
      try {
        setStatus('connecting')
        const ws = new WebSocket(WS_URL)
        wsRef.current = ws

        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        })
        pcRef.current = pc

        pc.ontrack = (ev) => {
          if (videoRef.current && ev.streams[0]) {
            videoRef.current.srcObject = ev.streams[0]
          }
        }

        // Minta video recvonly
        pc.addTransceiver('video', { direction: 'recvonly' })

        pc.onicecandidate = (ev) => {
          if (ev.candidate && ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({
              type: 'candidate',
              candidate: ev.candidate.candidate,
              sdpMLineIndex: ev.candidate.sdpMLineIndex,
            }))
          }
        }

        ws.onmessage = async (msg) => {
          const data = JSON.parse(msg.data)
          if (data.type === 'answer') {
            await pc.setRemoteDescription({ type: 'answer', sdp: data.sdp })
            setStatus('playing')
          } else if (data.type === 'candidate') {
            try {
              await pc.addIceCandidate({
                candidate: data.candidate,
                sdpMLineIndex: data.sdpMLineIndex ?? 0,
              })
            } catch (e) {
              console.warn('addIceCandidate failed', e)
            }
          }
        }

        // Tunggu WS open
        await new Promise<void>((resolve, reject) => {
          ws.onopen = () => resolve()
          ws.onerror = (e) => reject(e)
        })

        // Offer → kirim via WS
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        ws.send(JSON.stringify({ type: 'offer', sdp: offer.sdp }))
      } catch (e) {
        console.error(e)
        setStatus('error')
      }
    }

    start()
    return () => {
      try { wsRef.current?.close() } catch {}
      try { pcRef.current?.getSenders().forEach(s => s.track?.stop()) } catch {}
      try { pcRef.current?.close() } catch {}
    }
  }, [])

  return (
    <div className="space-y-2">
      <div className="text-sm opacity-70">Status: {status}</div>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        controls
        muted
        className="w-full rounded-2xl shadow"
      />
    </div>
  )
}
