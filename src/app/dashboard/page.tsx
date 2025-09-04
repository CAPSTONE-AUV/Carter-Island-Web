// src/app/dashboard/page.tsx
import { requireAuth } from '@/lib/auth-utils'
import Header from '@/components/layout/Header'
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
      
      <main className="p-6 lg:p-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
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
            <CardContent className="p-6">
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
            <CardContent className="p-6">
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
            <CardContent className="p-6">
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

          {/* User Profile */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-medium">
                    {session.user.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{session.user.fullName}</h4>
                    <p className="text-sm text-gray-500">{session.user.role}</p>
                  </div>
                </div>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Email</span>
                    <span className="font-medium text-gray-900 truncate ml-2">{session.user.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Phone</span>
                    <span className="font-medium text-gray-900">{session.user.phoneNumber}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  )
}