// src/app/dashboard/layout.tsx
import { requireAuth } from '@/lib/auth-utils'
import Sidebar from '@/components/layout/Sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireAuth()

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar session={session} />
      <div className="lg:ml-72 transition-all duration-300">
        {children}
      </div>
    </div>
  )
}