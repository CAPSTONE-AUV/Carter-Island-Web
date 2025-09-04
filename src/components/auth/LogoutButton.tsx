'use client'

import { signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface LogoutButtonProps {
  className?: string
  children?: React.ReactNode
}

export default function LogoutButton({ className, children }: LogoutButtonProps) {
  const router = useRouter()

  const handleLogout = async () => {
    await signOut({
      redirect: false,
      callbackUrl: '/'
    })
    router.push('/')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      className={className || "px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"}
    >
      {children || 'Sign Out'}
    </button>
  )
}