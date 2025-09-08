    // src/components/layout/Sidebar.tsx
    'use client'

    import { useState, useEffect } from 'react'
    import Link from 'next/link'
    import { usePathname } from 'next/navigation'
    import { 
    Radio, 
    Users, 
    Video, 
    Menu, 
    X, 
    Home,
    LogOut,
    ChevronLeft,
    BarChart3,
    Settings,
    HelpCircle
    } from 'lucide-react'
    import { Button } from '@/components/ui/button'
    import { Badge } from '@/components/ui/badge'
    import LogoutButton from '../auth/LogoutButton'

    interface SidebarProps {
    session: {
        user: {
        id: string
        fullName: string
        email: string
        phoneNumber: string
        role: 'USER' | 'ADMIN'
        }
    }
    }

    const Sidebar = ({ session }: SidebarProps) => {
    const [isCollapsed, setIsCollapsed] = useState(false)
    const [isMobileOpen, setIsMobileOpen] = useState(false)
    const pathname = usePathname()

    // Toggle body class untuk responsive content
    useEffect(() => {
        const body = document.body
        if (isCollapsed) {
        body.classList.add('sidebar-collapsed')
        } else {
        body.classList.remove('sidebar-collapsed')
        }
        
        return () => {
        body.classList.remove('sidebar-collapsed')
        }
    }, [isCollapsed])

    const mainMenuItems = [
        {
        id: 'dashboard',
        label: 'Dashboard',
        href: '/dashboard',
        icon: Home,
        description: 'Overview and mission control',
        roles: ['USER', 'ADMIN']
        },
        {
        id: 'stream',
        label: 'Live Stream',
        href: '/dashboard/stream',
        icon: Radio,
        description: 'Real-time underwater feed',
        roles: ['USER', 'ADMIN']
        },
        {
        id: 'recordings',
        label: 'Recordings',
        href: '/dashboard/recordings',
        icon: Video,
        description: 'Saved mission videos',
        roles: ['USER', 'ADMIN']
        },
        {
        id: 'analytics',
        label: 'Analytics',
        href: '/dashboard/analytics',
        icon: BarChart3,
        description: 'Mission data & insights',
        roles: ['USER', 'ADMIN']
        }
    ]

    const adminMenuItems = [
        {
        id: 'users',
        label: 'Manage User',
        href: '/dashboard/users',
        icon: Users,
        description: 'User management & roles',
        roles: ['ADMIN']
        },
        {
        id: 'settings',
        label: 'Settings',
        href: '/dashboard/settings',
        icon: Settings,
        description: 'System configuration',
        roles: ['ADMIN']
        }
    ]

    const generalMenuItems = [
        {
        id: 'help',
        label: 'Help',
        href: '/dashboard/help',
        icon: HelpCircle,
        description: 'Support & documentation',
        roles: ['USER', 'ADMIN']
        }
    ]

    const filteredMainItems = mainMenuItems.filter(item => 
        item.roles.includes(session.user.role)
    )
    
    const filteredAdminItems = adminMenuItems.filter(item => 
        item.roles.includes(session.user.role)
    )

    const isActive = (href: string) => {
        if (href === '/dashboard') {
        return pathname === href
        }
        return pathname.startsWith(href)
    }

    const MenuSection = ({ title, items }: { title?: string, items: any[] }) => (
        <div className="space-y-1">
        {title && !isCollapsed && (
            <p className={`
            px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 mt-4 first:mt-0
            transition-all duration-300 ease-out
            ${isCollapsed ? 'opacity-0 transform translate-x-4' : 'opacity-100 transform translate-x-0'}
            `}>
            {title}
            </p>
        )}
        {items.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            
            return (
            <Link
                key={item.id}
                href={item.href}
                onClick={() => setIsMobileOpen(false)}
                className={`
                flex items-start px-4 py-2.5 text-sm transition-all duration-300 ease-out relative group mx-2 rounded-lg
                ${active 
                    ? 'bg-blue-50 border-r-4 border-blue-600' 
                    : 'hover:bg-gray-50'
                }
                ${isCollapsed ? 'justify-center mx-1' : ''}
                `}
                title={isCollapsed ? item.label : undefined}
            >
                <Icon className={`
                h-5 w-5 flex-shrink-0 transition-colors duration-300 ease-out
                ${active 
                    ? 'text-blue-600' 
                    : 'text-gray-400 group-hover:text-gray-600'
                }
                `} />
                {!isCollapsed && (
                <div className={`
                    ml-3 flex-1 overflow-hidden
                    transition-all duration-300 ease-out
                    ${isCollapsed 
                    ? 'opacity-0 transform translate-x-4 w-0' 
                    : 'opacity-100 transform translate-x-0 w-auto'
                    }
                `}>
                    <div className={`
                    font-medium transition-colors duration-300 ease-out whitespace-nowrap
                    ${active 
                        ? 'text-blue-600' 
                        : 'text-gray-700 group-hover:text-gray-900'
                    }
                    `}>
                    {item.label}
                    </div>
                    <div className={`
                    text-xs mt-0.5 transition-colors duration-300 ease-out whitespace-nowrap
                    ${active 
                        ? 'text-blue-500' 
                        : 'text-gray-500 group-hover:text-gray-600'
                    }
                    `}>
                    {item.description}
                    </div>
                </div>
                )}
                {!isCollapsed && item.badge && (
                <Badge 
                    variant="secondary" 
                    className={`
                    ml-auto text-xs transition-all duration-300 ease-out
                    ${isCollapsed 
                        ? 'opacity-0 transform translate-x-4 scale-0' 
                        : 'opacity-100 transform translate-x-0 scale-100'
                    }
                    `}
                >
                    {item.badge}
                </Badge>
                )}
            </Link>
            )
        })}
        </div>
    )

    return (
        <>
        {/* Mobile backdrop */}
        {isMobileOpen && (
            <div 
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setIsMobileOpen(false)}
            />
        )}

        {/* Mobile menu button */}
        <div className="lg:hidden fixed top-4 left-4 z-50">
            <Button
            variant="outline"
            size="icon"
            onClick={() => setIsMobileOpen(true)}
            className="bg-white shadow-lg"
            >
            <Menu className="h-4 w-4" />
            </Button>
        </div>

        {/* Sidebar */}
        <div className={`
            fixed top-0 left-0 h-full bg-white border-r border-gray-200 shadow-sm
            transition-all duration-500 ease-out z-50 flex flex-col transform-gpu
            ${isCollapsed ? 'w-16' : 'w-72'}
            ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-4">
            <MenuSection title="MENU" items={filteredMainItems} />
            {filteredAdminItems.length > 0 && (
                <MenuSection title="ADMIN" items={filteredAdminItems} />
            )}
            <MenuSection title="GENERAL" items={generalMenuItems} />
            </nav>

            {/* Logout Button */}
            <div className="border-t border-gray-100 p-4">
            <LogoutButton 
                className={`
                w-full flex items-start px-3 py-2.5 text-sm transition-all duration-300 ease-out hover:bg-red-50 rounded-lg group mx-1
                ${isCollapsed ? 'justify-center' : ''}
                `}
            >
                <LogOut className="h-5 w-5 flex-shrink-0 text-gray-400 group-hover:text-red-600 transition-colors duration-300 ease-out" />
                {!isCollapsed && (
                <div className={`
                    ml-3 flex-1 text-left overflow-hidden
                    transition-all duration-300 ease-out
                    ${isCollapsed 
                    ? 'opacity-0 transform translate-x-4 w-0' 
                    : 'opacity-100 transform translate-x-0 w-auto'
                    }
                `}>
                    <div className="font-medium text-gray-700 group-hover:text-red-600 transition-colors duration-300 ease-out whitespace-nowrap">
                    Logout
                    </div>
                    <div className="text-xs text-gray-500 group-hover:text-red-500 mt-0.5 transition-colors duration-300 ease-out whitespace-nowrap">
                    Sign out of account
                    </div>
                </div>
                )}
            </LogoutButton>
            </div>
        </div>
        </>
    )
    }

    export default Sidebar