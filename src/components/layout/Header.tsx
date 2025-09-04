// src/components/layout/Header.tsx
import { ReactNode } from 'react'

interface HeaderProps {
  title: string
  subtitle?: string
  children?: ReactNode
}

const Header = ({ title, subtitle, children }: HeaderProps) => {
  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4 lg:px-8">
      <div className="flex items-center justify-between">
        <div className="ml-16 lg:ml-0">
          <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
          {subtitle && <p className="text-gray-600 mt-1">{subtitle}</p>}
        </div>
        {children && <div className="flex items-center space-x-4">{children}</div>}
      </div>
    </div>
  )
}

export default Header