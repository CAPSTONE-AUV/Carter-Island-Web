// src/components/users/UserDialog.tsx
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

interface User {
  id: string
  fullName: string
  email: string
  phoneNumber: string
  role: 'USER' | 'ADMIN'
  createdAt: string
  updatedAt: string
}

interface UserDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  user?: User | null
  mode: 'create' | 'edit' | 'view'
}

interface FormData {
  fullName: string
  email: string
  password: string
  phoneNumber: string
  role: 'USER' | 'ADMIN'
}

interface SubmitData {
  fullName: string
  email: string
  password?: string
  phoneNumber: string
  role: 'USER' | 'ADMIN'
}

export default function UserDialog({ 
  isOpen, 
  onClose, 
  onSuccess, 
  user, 
  mode 
}: UserDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    email: '',
    password: '',
    phoneNumber: '',
    role: 'USER'
  })

  useEffect(() => {
    if (isOpen) {
      if (mode === 'create') {
        setFormData({
          fullName: '',
          email: '',
          password: '',
          phoneNumber: '',
          role: 'USER'
        })
      } else if ((mode === 'edit' || mode === 'view') && user) {
        setFormData({
          fullName: user.fullName || '',
          email: user.email || '',
          password: '',
          phoneNumber: user.phoneNumber || '',
          role: user.role || 'USER'
        })
      }
    }
  }, [isOpen, mode, user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const url = mode === 'create' ? '/api/users' : `/api/users/${user?.id}`
      const method = mode === 'create' ? 'POST' : 'PUT'
      
      const submitData: SubmitData = {
        fullName: formData.fullName,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        role: formData.role
      }
      
      if (mode === 'create' || formData.password.trim()) {
        submitData.password = formData.password
      }
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong')
      }

      toast.success(data.message || `User ${mode === 'create' ? 'created' : 'updated'} successfully`)
      onSuccess()
      onClose()
      
      // Reset form setelah sukses
      setFormData({
        fullName: '',
        email: '',
        password: '',
        phoneNumber: '',
        role: 'USER'
      })
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleClose = () => {
    // Reset form saat dialog ditutup
    setFormData({
      fullName: '',
      email: '',
      password: '',
      phoneNumber: '',
      role: 'USER'
    })
    onClose()
  }

  const getTitle = () => {
    switch (mode) {
      case 'create': return 'Add New User'
      case 'edit': return `Edit User - ${user?.fullName}`
      case 'view': return `User Details - ${user?.fullName}`
      default: return 'User'
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
        </DialogHeader>

        {mode === 'view' ? (
          // View Mode
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-gray-600">Full Name</Label>
              <p className="mt-1 text-sm text-gray-900">{user?.fullName}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-600">Email</Label>
              <p className="mt-1 text-sm text-gray-900">{user?.email}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-600">Phone Number</Label>
              <p className="mt-1 text-sm text-gray-900">{user?.phoneNumber}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-600">Role</Label>
              <div className="mt-1">
                <Badge variant={user?.role === 'ADMIN' ? 'default' : 'secondary'}>
                  {user?.role}
                </Badge>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-600">Created</Label>
                <p className="mt-1 text-xs text-gray-500">{user?.createdAt}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Updated</Label>
                <p className="mt-1 text-xs text-gray-500">{user?.updatedAt}</p>
              </div>
            </div>
          </div>
        ) : (
          // Create/Edit Mode
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                value={formData.fullName}
                onChange={(e) => handleInputChange('fullName', e.target.value)}
                placeholder="Enter full name"
                required
                autoComplete="name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="Enter email address"
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                Password {mode === 'create' ? '*' : '(leave blank to keep current)'}
              </Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                placeholder={mode === 'create' ? 'Enter password' : 'Enter new password'}
                required={mode === 'create'}
                autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number *</Label>
              <Input
                id="phoneNumber"
                value={formData.phoneNumber}
                onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                placeholder="Enter phone number"
                required
                autoComplete="tel"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role *</Label>
              <Select 
                value={formData.role} 
                onValueChange={(value: 'USER' | 'ADMIN') => handleInputChange('role', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">User</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  mode === 'create' ? 'Create User' : 'Update User'
                )}
              </Button>
            </DialogFooter>
          </form>
        )}

        {mode === 'view' && (
          <DialogFooter>
            <Button onClick={handleClose}>Close</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}