import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export default async function HomePage() {
  const session = await getServerSession(authOptions)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-blue-600 mb-4">Carter Island</h1>
          <p className="text-2xl text-gray-600 mb-8">Autonomous Underwater Vehicle Dashboard</p>
          <p className="text-lg text-gray-700 mb-12 max-w-2xl mx-auto">
            Advanced control system for underwater exploration and research missions. 
            Monitor, control, and manage your AUV operations with precision and reliability.
          </p>

          {session ? (
            <div className="space-y-4">
              <p className="text-lg text-gray-700">
                Welcome back, <strong>{session.user.fullName}</strong>!
              </p>
              <Link 
                href="/dashboard" 
                className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Go to Dashboard
              </Link>
            </div>
          ) : (
            <div className="space-x-4">
              <Link 
                href="/auth/login" 
                className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Sign In
              </Link>
              <Link 
                href="/auth/register" 
                className="inline-block bg-gray-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-gray-700 transition-colors"
              >
                Create Account
              </Link>
            </div>
          )}
        </div>

        <div className="mt-16 grid md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-lg shadow-md text-center">
            <div className="text-blue-600 text-4xl mb-4">🌊</div>
            <h3 className="text-xl font-semibold mb-2">Real-time Monitoring</h3>
            <p className="text-gray-600">Monitor your AUV's position, status, and sensor data in real-time.</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md text-center">
            <div className="text-blue-600 text-4xl mb-4">🎯</div>
            <h3 className="text-xl font-semibold mb-2">Mission Control</h3>
            <p className="text-gray-600">Plan, execute, and manage underwater missions with precision.</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md text-center">
            <div className="text-blue-600 text-4xl mb-4">📊</div>
            <h3 className="text-xl font-semibold mb-2">Data Analytics</h3>
            <p className="text-gray-600">Analyze collected data and generate comprehensive reports.</p>
          </div>
        </div>
      </div>
    </div>
  )
}