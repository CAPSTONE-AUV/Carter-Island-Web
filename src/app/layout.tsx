// src/app/layout.tsx
import SessionProvider from '@/components/providers/SessionProvider'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

export const metadata = {
  title: 'Carter Island AUV Dashboard',
  description: 'Autonomous Underwater Vehicle Control System',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50">
        <SessionProvider>
          {children}
        </SessionProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  )
}