// src/app/dashboard/page.tsx
import { requireAuth } from '@/lib/auth-utils'
import Header from '@/components/layout/Header'
import MapButton from '@/components/ui/MapButton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Activity, Wifi, Clock, MapPin, Camera, Fish, TrendingUp } from 'lucide-react'

export default async function DashboardPage() {
  const session = await requireAuth()

  return (
    <>
      <Header 
        title="Dashboard" 
        subtitle={`Welcome back, ${session.user.fullName}`}
      />
      
      <main className="p-0 lg:px-4 mt-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="px-6 py-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">AUV Status</p>
                  <p className="text-2xl font-semibold text-gray-900">Online</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <Activity className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="px-6 py-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Connection</p>
                  <p className="text-2xl font-semibold text-gray-900">Strong</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Wifi className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="px-6 py-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Uptime</p>
                  <p className="text-2xl font-semibold text-gray-900">2h 15m</p>
                </div>
                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                  <Clock className="w-6 h-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="px-6 py-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Location</p>
                  <p className="text-2xl font-semibold text-gray-900">Active</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Quick Actions */}
          <Card className="lg:col-span-2 border-0 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Fish className="h-5 w-5 text-blue-600" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Button className="h-16 flex-col gap-2" variant="default">
                  <Activity size={20} />
                  <span className="text-sm">Start Mission</span>
                </Button>
                <Button variant="outline" className="h-16 flex-col gap-2">
                  <Camera size={20} />
                  <span className="text-sm">Live Stream</span>
                </Button>
                <Button variant="outline" className="h-16 flex-col gap-2">
                  <Clock size={20} />
                  <span className="text-sm">View Logs</span>
                </Button>
                <Button variant="outline" className="h-16 flex-col gap-2">
                  <MapPin size={20} />
                  <span className="text-sm">Navigation</span>
                </Button>
                {session.user.role === 'ADMIN' && (
                  <>
                    <Button variant="outline" className="h-16 flex-col gap-2 border-red-200 text-red-600 hover:bg-red-50">
                      <TrendingUp size={20} />
                      <span className="text-sm">System</span>
                    </Button>
                    <Button variant="outline" className="h-16 flex-col gap-2">
                      <Activity size={20} />
                      <span className="text-sm">Settings</span>
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* AUV Location Map */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="h-5 w-5 text-purple-600" />
                AUV Detail Location
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Real Google Maps Embed with Custom Marker Overlay */}
                <div className="w-full h-48 rounded-xl overflow-hidden border border-gray-200 relative">
                  <iframe
                    src="https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d3961.785!2d110.63642!3d-6.62177!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f15.1!5e0!3m2!1sen!2sid!4v1699123456789!5m2!1sen!2sid"
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    className="rounded-xl"
                  />
                  
                  {/* Custom Animated AUV Marker - positioned over the map */}
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
                    <div className="relative flex items-center justify-center">
                      {/* Pulsing ring animation */}
                      <div className="absolute w-6 h-6 bg-red-500 rounded-full animate-ping opacity-75"></div>
                      <div className="absolute w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
                      {/* Center dot */}
                      <div className="relative w-2 h-2 bg-red-600 rounded-full"></div>
                    </div>
                  </div>
                </div>

                {/* Location Details */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Depth</span>
                      <span className="font-medium text-gray-900">15.2m</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Speed</span>
                      <span className="font-medium text-gray-900">2.3 kts</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Heading</span>
                      <span className="font-medium text-gray-900">045°</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Battery</span>
                      <span className="font-medium text-green-600">87%</span>
                    </div>
                  </div>
                </div>

                {/* Action Button - Opens Google Maps in new tab */}
                <MapButton 
                  lat={-6.621770076466091}
                  lng={110.64180349373554}
                  className="w-full"
                >
                  View Full Map
                </MapButton>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  )
}