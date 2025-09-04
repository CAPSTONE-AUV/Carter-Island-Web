import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { redirect } from 'next/navigation'

export async function getAuthSession() {
  return await getServerSession(authOptions)
}

export async function requireAuth() {
  const session = await getAuthSession()
  if (!session) {
    redirect('/auth/login')
  }
  return session
}

export async function requireAdmin() {
  const session = await requireAuth()
  if (session.user.role !== 'ADMIN') {
    redirect('/unauthorized')
  }
  return session
}

export function hasRole(session: any, role: 'USER' | 'ADMIN') {
  return session?.user?.role === role
}