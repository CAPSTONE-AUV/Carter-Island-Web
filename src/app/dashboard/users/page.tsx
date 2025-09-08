// src/app/dashboard/users/page.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import UserDialog from '@/components/users/UserDialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination'
import { toast } from 'sonner'
import { Loader2, Plus, Edit, Eye, Trash2 } from 'lucide-react'

interface User {
  id: string
  fullName: string
  email: string
  phoneNumber: string
  role: 'USER' | 'ADMIN'
  createdAt: string
  updatedAt: string
}

type UsersResponse = {
  data: User[]
  total: number
}

export default function UsersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)

  // Pagination state
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10) // page size

  const pageCount = useMemo(() => {
    return Math.max(1, Math.ceil(total / limit))
  }, [total, limit])

  const [dialogState, setDialogState] = useState<{
    isOpen: boolean
    mode: 'create' | 'edit' | 'view'
    user: User | null
  }>({
    isOpen: false,
    mode: 'create',
    user: null,
  })

  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean
    user: User | null
    isDeleting: boolean
  }>({
    isOpen: false,
    user: null,
    isDeleting: false,
  })

  // Check authorization
  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push('/auth/login')
      return
    }

    if (session.user.role !== 'ADMIN') {
      router.push('/dashboard')
      toast.error('Access denied. Admin privileges required.')
      return
    }
  }, [session, status, router])

  const fetchUsers = async (opts?: { page?: number; limit?: number }) => {
  const currentPage = opts?.page ?? page
  const currentLimit = opts?.limit ?? limit
  try {
    setLoading(true)
    const response = await fetch(`/api/users?page=${currentPage}&limit=${currentLimit}`)
    if (!response.ok) throw new Error('Failed to fetch users')

    const json = await response.json() as UsersResponse | User[]

    // Jika backend SUDAH mem-paginate: { data, total }
    if (!Array.isArray(json)) {
      setUsers(json.data)           // <- sudah 5 item dari server
      setTotal(json.total)
      return
    }

    // Fallback: backend mengembalikan SELURUH data (array)
    const all = json as User[]
    const start = (currentPage - 1) * currentLimit
    const end = start + currentLimit
    setUsers(all.slice(start, end)) // <- potong sesuai page & limit
    setTotal(all.length)
  } catch (e) {
    console.error('Error fetching users:', e)
    toast.error('Failed to load users')
  } finally {
    setLoading(false)
  }
}


  // initial & whenever page/limit changes
  useEffect(() => {
    if (session?.user.role === 'ADMIN') {
      fetchUsers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, page, limit])

  // Handle dialog actions
  const handleAddUser = () => {
    setDialogState({
      isOpen: true,
      mode: 'create',
      user: null,
    })
  }

  const handleEditUser = (user: User) => {
    setDialogState({
      isOpen: true,
      mode: 'edit',
      user,
    })
  }

  const handleViewUser = (user: User) => {
    setDialogState({
      isOpen: true,
      mode: 'view',
      user,
    })
  }

  const handleDeleteUser = (user: User) => {
    setDeleteDialog({
      isOpen: true,
      user,
      isDeleting: false,
    })
  }

  const confirmDelete = async () => {
    if (!deleteDialog.user) return
    try {
      setDeleteDialog((prev) => ({ ...prev, isDeleting: true }))
      const response = await fetch(`/api/users/${deleteDialog.user.id}`, {
        method: 'DELETE',
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete user')
      }

      toast.success(data.message || 'User deleted successfully')

      // Reload current page — jika data di halaman ini habis setelah delete, mundurkan halaman 1 langkah
      const isLastItemOnPage = users.length === 1 && page > 1
      const nextPage = isLastItemOnPage ? page - 1 : page
      if (isLastItemOnPage) setPage(nextPage)

      await fetchUsers({ page: nextPage })
      setDeleteDialog({ isOpen: false, user: null, isDeleting: false })
    } catch (error: any) {
      console.error('Error deleting user:', error)
      toast.error(error.message || 'Failed to delete user')
      setDeleteDialog((prev) => ({ ...prev, isDeleting: false }))
    }
  }

  const closeDialog = () => {
    setDialogState({
      isOpen: false,
      mode: 'create',
      user: null,
    })
  }

  const handleDialogSuccess = () => {
    // setelah create/edit, refresh data (tetap di page sekarang)
    fetchUsers()
  }

  // Show loading while checking auth
  if (status === 'loading' || !session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  // Only render for admins
  if (session.user.role !== 'ADMIN') {
    return null
  }

  // Helpers for Pagination numbers (menampilkan sekitar current page)
  const visiblePages = useMemo(() => {
    const pages: number[] = []
    const delta = 1 // tampilkan 1 kiri/kanan dari current
    const start = Math.max(1, page - delta)
    const end = Math.min(pageCount, page + delta)

    for (let p = start; p <= end; p++) pages.push(p)
    return pages
  }, [page, pageCount])

  return (
    <>
      <Header title="User Management" subtitle="Manage system users and permissions">
        <Button onClick={handleAddUser} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add New User
        </Button>
      </Header>

      <main className="flex-1 overflow-auto p-6">
        <Card>
          <CardContent className="p-6">
            {/* Toolbar atas: page size & info */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div className="text-sm text-muted-foreground">
                {total > 0 ? (
                  <>
                    Showing{' '}
                    <span className="font-medium">
                      {Math.min((page - 1) * limit + 1, total)}
                    </span>{' '}
                    to{' '}
                    <span className="font-medium">
                      {Math.min(page * limit, total)}
                    </span>{' '}
                    of <span className="font-medium">{total}</span> users
                  </>
                ) : (
                  'No users'
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm">Rows per page</span>
                <Select
                  value={String(limit)}
                  onValueChange={(v) => {
                    const newLimit = parseInt(v, 10)
                    setLimit(newLimit)
                    setPage(1) // reset ke halaman 1 ketika ganti page size
                  }}
                >
                  <SelectTrigger className="h-8 w-[88px]">
                    <SelectValue placeholder={limit} />
                  </SelectTrigger>
                  <SelectContent>
                    {[5, 10, 20, 30, 50].map((sz) => (
                      <SelectItem key={sz} value={String(sz)}>
                        {sz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-2">Loading users...</span>
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">No users found</p>
                <Button onClick={handleAddUser} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add First User
                </Button>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Phone
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Role
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Created
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {users.map((user) => (
                        <tr key={user.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {user.fullName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {user.email}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {user.phoneNumber}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge
                              variant={user.role === 'ADMIN' ? 'default' : 'secondary'}
                              className={
                                user.role === 'ADMIN'
                                  ? 'bg-red-100 text-red-800 hover:bg-red-200'
                                  : 'bg-green-100 text-green-800 hover:bg-green-200'
                              }
                            >
                              {user.role}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {user.createdAt}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewUser(user)}
                              className="inline-flex items-center gap-1"
                            >
                              <Eye className="h-3 w-3" />
                              View
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleEditUser(user)}
                              className="inline-flex items-center gap-1"
                            >
                              <Edit className="h-3 w-3" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteUser(user)}
                              disabled={user.id === session.user.id} // Prevent self-deletion
                              className="inline-flex items-center gap-1"
                            >
                              <Trash2 className="h-3 w-3" />
                              Delete
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Page <span className="font-medium">{page}</span> of{' '}
                    <span className="font-medium">{pageCount}</span>
                  </div>

                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(e) => {
                            e.preventDefault()
                            if (page > 1) setPage(page - 1)
                          }}
                          aria-disabled={page <= 1}
                          className={page <= 1 ? 'pointer-events-none opacity-50' : ''}
                        />
                      </PaginationItem>

                      {/* First page & leading ellipsis */}
                      {page > 2 && (
                        <>
                          <PaginationItem>
                            <PaginationLink
                              href="#"
                              onClick={(e) => {
                                e.preventDefault()
                                setPage(1)
                              }}
                            >
                              1
                            </PaginationLink>
                          </PaginationItem>
                          {page > 3 && (
                            <PaginationItem>
                              <PaginationEllipsis />
                            </PaginationItem>
                          )}
                        </>
                      )}

                      {/* Visible pages around current */}
                      {visiblePages.map((p) => (
                        <PaginationItem key={p}>
                          <PaginationLink
                            href="#"
                            isActive={p === page}
                            onClick={(e) => {
                              e.preventDefault()
                              setPage(p)
                            }}
                          >
                            {p}
                          </PaginationLink>
                        </PaginationItem>
                      ))}

                      {/* Trailing ellipsis & last page */}
                      {page < pageCount - 1 && (
                        <>
                          {page < pageCount - 2 && (
                            <PaginationItem>
                              <PaginationEllipsis />
                            </PaginationItem>
                          )}
                          <PaginationItem>
                            <PaginationLink
                              href="#"
                              onClick={(e) => {
                                e.preventDefault()
                                setPage(pageCount)
                              }}
                            >
                              {pageCount}
                            </PaginationLink>
                          </PaginationItem>
                        </>
                      )}

                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={(e) => {
                            e.preventDefault()
                            if (page < pageCount) setPage(page + 1)
                          }}
                          aria-disabled={page >= pageCount}
                          className={page >= pageCount ? 'pointer-events-none opacity-50' : ''}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>

      {/* User Dialog */}
      <UserDialog
        isOpen={dialogState.isOpen}
        onClose={closeDialog}
        onSuccess={handleDialogSuccess}
        user={dialogState.user}
        mode={dialogState.mode}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.isOpen}
        onOpenChange={() =>
          setDeleteDialog({ isOpen: false, user: null, isDeleting: false })
        }
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <strong>{deleteDialog.user?.fullName}</strong>? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() =>
                setDeleteDialog({ isOpen: false, user: null, isDeleting: false })
              }
              disabled={deleteDialog.isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteDialog.isDeleting}
            >
              {deleteDialog.isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                'Delete User'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
