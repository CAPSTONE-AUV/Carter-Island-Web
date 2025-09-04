// src/components/auth/LoginForm.tsx
'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { LoginData } from '@/types/auth'
import { Anchor } from 'lucide-react'
import { toast } from 'sonner'
import LoadingOverlay from '@/components/ui/LoadingOverlay'

export default function LoginForm() {
  const [formData, setFormData] = useState<LoginData>({
    email: '',
    password: ''
  })
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.email.trim() || !formData.password.trim()) {
      toast.error('Email and password are required')
      return
    }

    setLoading(true)

    try {
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false
      })

      if (result?.error) {
        const errorMessage =
          result.error === 'CredentialsSignin'
            ? 'Invalid email or password'
            : 'An error occurred while logging in'

        toast.error(errorMessage)
      } else {
        toast.success('Login successful! Welcome back.')
        router.push('/dashboard')
        router.refresh()
      }
    } catch {
      toast.error('An error occurred while logging in')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-8">
      {/* Kunci tinggi card di breakpoint md ke atas agar image mengikuti card */}
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl shadow-2xl bg-white md:h-[560px]">
        {/* Grid 2 kolom */}
        <div className="grid md:grid-cols-2 h-full">
          {/* LEFT: Form */}
          <div className="px-6 py-8 md:px-8 md:py-12 overflow-y-auto">
            {/* Header */}
            <div className="text-center mb-4">
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-blue-600 rounded-full">
                  <Anchor className="h-8 w-8 text-white" />
                </div>
              </div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                Carter Island AUV
              </h1>
              <p className="text-gray-500">
                Navigation Control Autonomous Underwater Vehicle MSTP Teluk Awur Jepara
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  className="w-full h-11 px-4 border-2 border-gray-200 rounded-xl bg-white/70 backdrop-blur-sm 
                           placeholder:text-gray-400 text-gray-800
                           focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100
                           disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200"
                  autoComplete="email"
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-gray-700">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    disabled={loading}
                    className="w-full h-11 px-4 pr-12 border-2 border-gray-200 rounded-xl bg-white/70 backdrop-blur-sm 
                             placeholder:text-gray-400 text-gray-800
                             focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100
                             disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading}
                  >
                    {showPassword ? (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Remember & Forgot */}
              <div className="flex items-center justify-between text-sm py-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    disabled={loading}
                  />
                  <span className="text-gray-600">Remember Me</span>
                </label>
                <a href="#" className="text-blue-600 hover:underline font-medium">
                  Forgot your password?
                </a>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-gray-200 text-gray-600 rounded-xl font-semibold tracking-wide
                         hover:bg-blue-600 hover:text-white focus:bg-blue-600 focus:text-white
                         active:bg-blue-700 active:scale-[0.98]
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                         disabled:opacity-60 disabled:cursor-not-allowed 
                         transition-all duration-200 ease-out"
              >
                {loading ? 'Processing...' : 'Login'}
              </button>
            </form>
          </div>

          {/* RIGHT: Image (mengikuti card, di-crop bila perlu) */}
          <div className="relative hidden md:block h-full overflow-hidden">
            <img
              src="https://firebasestorage.googleapis.com/v0/b/seputipy.appspot.com/o/covers%2FROBLOKS.png?alt=media"
              alt="Carter Island AUV - Underwater Navigation System"
              className="absolute inset-0 h-full w-full object-cover"
            />
            {/* Overlay */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-600/10 to-indigo-600/20"></div>
          </div>
        </div>
      </div>

      {/* Loading Overlay */}
      <LoadingOverlay
        isVisible={loading}
        message="Logging in"
        showDots={true}
        size="md"
      />
    </div>
  )
}
