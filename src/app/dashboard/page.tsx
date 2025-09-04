import { requireAuth } from '@/lib/auth-utils'
import LogoutButton from '@/components/auth/LogoutButton'

export default async function DashboardPage() {
  const session = await requireAuth()

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-blue-600 text-white p-4">
        <div className="container mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Carter Island AUV</h1>
            <p className="text-blue-100">Dashboard v{process.env.APP_VERSION}</p>
          </div>
          <div className="flex items-center space-x-4">
            <span>Welcome, {session.user.fullName}</span>
            <span className="bg-blue-500 px-2 py-1 rounded text-xs">
              {session.user.role}
            </span>
            <LogoutButton className="bg-red-500 hover:bg-red-600 px-3 py-1 rounded text-sm transition-colors" />
          </div>
        </div>
      </nav>

      <main className="container mx-auto py-8 px-4">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">User Profile</h2>
            <div className="space-y-2">
              <p><strong>Name:</strong> {session.user.fullName}</p>
              <p><strong>Email:</strong> {session.user.email}</p>
              <p><strong>Phone:</strong> {session.user.phoneNumber}</p>
              <p><strong>Role:</strong> {session.user.role}</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">AUV Status</h2>
            <div className="text-green-600">
              <p>● Online</p>
              <p className="text-sm text-gray-600 mt-2">
                Last updated: {new Date().toLocaleString('en-US')}
              </p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <button className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors">
                Start Mission
              </button>
              <button className="w-full bg-gray-600 text-white py-2 px-4 rounded hover:bg-gray-700 transition-colors">
                View Logs
              </button>
            </div>
          </div>
        </div>

        {session.user.role === 'ADMIN' && (
          <div className="mt-8 bg-yellow-50 border border-yellow-200 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4 text-yellow-800">Admin Panel</h2>
            <p className="text-yellow-700">You have admin access to manage the system.</p>
            <div className="mt-4 space-x-4">
              <button className="bg-yellow-600 text-white py-2 px-4 rounded hover:bg-yellow-700 transition-colors">
                Manage Users
              </button>
              <button className="bg-yellow-600 text-white py-2 px-4 rounded hover:bg-yellow-700 transition-colors">
                System Settings
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}