// src/app/auth/login/page.tsx
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import LoginForm from '@/components/auth/LoginForm'

export const metadata = {
  title: 'Login - Carter Island AUV',
  description: 'Sign in to Carter Island AUV Dashboard System',
}

export default async function LoginPage() {
  const session = await getServerSession(authOptions)
  
  if (session) {
    redirect('/dashboard')
  }

  return <LoginForm />
}