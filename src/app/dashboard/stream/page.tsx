// src/app/dashboard/stream/page.tsx
import { requireAuth } from '@/lib/auth-utils'
import Header from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Camera, Activity } from 'lucide-react'

export default async function StreamPage() {
  await requireAuth()

  return (
    <>
      <Header 
        title="Fish Farm Monitoring" 
        subtitle="Live underwater camera feed from Carter Island AUV"
      >
        <Button className="flex items-center gap-2">
          <Camera className="h-4 w-4" />
          Start Stream
        </Button>
      </Header>
      
      <main className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Stream Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                  <span className="text-sm font-medium">Offline</span>
                </div>
                <div className="text-sm text-slate-600">Viewers: 0</div>
                <div className="text-sm text-slate-600">Duration: --:--:--</div>
                <div className="text-sm text-slate-600">Quality: HD 1080p</div>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-3 bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Live Feed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="aspect-video bg-slate-800 rounded-lg flex items-center justify-center">
                <div className="text-center text-white">
                  <Camera className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Stream Offline</p>
                  <p className="text-sm opacity-75">Carter Island Underwater Camera</p>
                </div>
              </div>
              <div className="mt-4 flex justify-between items-center">
                <div className="flex space-x-2">
                  <Button size="sm">Record</Button>
                  <Button variant="secondary" size="sm">Screenshot</Button>
                  <Button variant="destructive" size="sm">Stop</Button>
                </div>
                <div className="text-sm text-slate-500">
                  Resolution: 1920x1080 | FPS: 30
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  )
}