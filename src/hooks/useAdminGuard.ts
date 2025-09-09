// src/hooks/useAdminGuard.ts
'use client'
import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export function useAdminGuard() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return
    if (!session) { router.push('/auth/login'); return }
    if (session.user?.role !== 'ADMIN') {
      toast.error('Access denied. Admin privileges required.')
      router.push('/dashboard')
    }
  }, [session, status, router])

  return { session, status }
}
