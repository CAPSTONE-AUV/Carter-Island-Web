'use client'

import { useState, useEffect } from 'react'
import { requireAuth } from '@/lib/auth-utils'
import Header from '@/components/layout/Header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Play, Download, Trash2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

interface Recording {
  filename: string
  size: number
  size_mb: number
  created_at: string
  modified_at: string
}

export default function RecordingsPage() {
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [loading, setLoading] = useState(true)
  const [playingVideo, setPlayingVideo] = useState<string | null>(null)

  const fetchRecordings = async () => {
    try {
      setLoading(true)
      const response = await fetch('http://localhost:8000/api/recordings')
      if (!response.ok) throw new Error('Failed to fetch recordings')
      
      const data = await response.json()
      setRecordings(data.recordings)
    } catch (error) {
      console.error('Error fetching recordings:', error)
      toast.error('Gagal memuat daftar rekaman')
    } finally {
      setLoading(false)
    }
  }

  const handlePlay = (filename: string) => {
    setPlayingVideo(filename)
  }

  const handleDownload = (filename: string) => {
    const link = document.createElement('a')
    link.href = `http://localhost:8000/api/recordings/${filename}`
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleDelete = async (filename: string) => {
    if (!confirm(`Hapus rekaman ${filename}?`)) return

    try {
      const response = await fetch(`http://localhost:8000/api/recordings/${filename}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) throw new Error('Failed to delete recording')
      
      toast.success('Rekaman berhasil dihapus')
      await fetchRecordings()
    } catch (error) {
      console.error('Error deleting recording:', error)
      toast.error('Gagal menghapus rekaman')
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('id-ID')
  }

  useEffect(() => {
    fetchRecordings()
  }, [])

  return (
    <>
      <Header 
        title="Recordings" 
        subtitle="Manage AUV Video Recordings" 
        emoji="📹"
      />
      
      <main className="p-0 lg:px-4 mt-4 space-y-4">
        {/* Video Player Modal */}
        {playingVideo && (
          <Card>
            <CardContent className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Playing: {playingVideo}</h3>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setPlayingVideo(null)}
                >
                  Close
                </Button>
              </div>
              <video 
                src={`/api/recordings/${playingVideo}`}
                controls
                className="w-full max-h-96 bg-black rounded"
                autoPlay
              />
            </CardContent>
          </Card>
        )}

        {/* Controls */}
        <Card className="border-0 shadow-sm">
          <CardContent className="px-4 py-3">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-medium">
                Recording List ({recordings.length} files)
              </h2>
              <Button 
                size="sm" 
                onClick={fetchRecordings}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recordings Table */}
        <Card>
          <CardContent className="p-6">
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : recordings.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Belum ada rekaman tersedia
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Size
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {recordings.map((recording) => (
                      <tr key={recording.filename} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {recording.filename}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatFileSize(recording.size)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(recording.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          <Button 
                            size="sm"
                            onClick={() => handlePlay(recording.filename)}
                          >
                            <Play className="h-3 w-3 mr-1" />
                            Play
                          </Button>
                          <Button 
                            variant="secondary" 
                            size="sm"
                            onClick={() => handleDownload(recording.filename)}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Download
                          </Button>
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => handleDelete(recording.filename)}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  )
}