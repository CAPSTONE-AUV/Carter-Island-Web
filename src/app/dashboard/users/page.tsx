// src/app/dashboard/users/page.tsx
'use client'

import Header from '@/components/layout/Header'
import UserDialog from '@/components/users/UserDialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, Plus } from 'lucide-react'
import { useState } from 'react'
import { useAdminGuard } from '@/hooks/useAdminGuard'
import { useUsersPagination, type User } from '@/hooks/useUsersPagination'
import { FiltersBar } from './FiltersBar'
import { UsersTable } from './UsersTable'
import { toast } from 'sonner'

export default function UsersPage() {
  const { session, status } = useAdminGuard()
  const {
    users, isLoading, error, hasMore, loadMore, removeFromList,
    limit, setLimit, role, setRole, search, setSearch, sort, setSort
  } = useUsersPagination({ enabled: status === 'authenticated' && session?.user.role === 'ADMIN' })

  const [dialogState, setDialogState] = useState<{isOpen:boolean; mode:'create'|'edit'|'view'; user:User|null}>({ isOpen:false, mode:'create', user:null })
  const [deleteDialog, setDeleteDialog] = useState<{isOpen:boolean; user:User|null; isDeleting:boolean}>({ isOpen:false, user:null, isDeleting:false })

  if (status === 'loading' || !session) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }
  if (session.user.role !== 'ADMIN') return null

  const handleAddUser = () => setDialogState({ isOpen:true, mode:'create', user:null })
  const handleEditUser = (user:User) => setDialogState({ isOpen:true, mode:'edit', user })
  const handleViewUser = (user:User) => setDialogState({ isOpen:true, mode:'view', user })
  const handleDeleteUser = (user:User) => setDeleteDialog({ isOpen:true, user, isDeleting:false })

  const confirmDelete = async () => {
    const u = deleteDialog.user; if (!u) return
    try {
      setDeleteDialog(p => ({ ...p, isDeleting:true }))
      const res = await fetch(`/api/users/${u.id}`, { method:'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to delete user')
      removeFromList(u.id)
      toast.success(data?.message || 'User deleted successfully')
      setDeleteDialog({ isOpen:false, user:null, isDeleting:false })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e:any) {
      toast.error(e?.message || 'Failed to delete user')
      setDeleteDialog(p => ({ ...p, isDeleting:false }))
    }
  }

  return (
    <>
      <Header title="User Management" subtitle="Manage System Users and Permissions" emoji="🔧">
        <Button onClick={handleAddUser} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white">
          <Plus className="h-4 w-4" /> Add New User
        </Button>
      </Header>

      <main className="p-0 lg:px-4 mt-4">
        <Card>
          <CardContent className="px-4">
            <FiltersBar
              limit={limit} setLimit={setLimit}
              role={role} setRole={setRole}
              search={search} setSearch={setSearch}
              sort={sort} setSort={setSort}
              loadedCount={users.length} hasMore={hasMore}
            />

            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md"><p className="text-sm text-red-600">{error}</p></div>}

            {isLoading && users.length === 0 ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /><span className="ml-2">Loading users...</span></div>
            ) : users.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">No users found</p>
              </div>
            ) : (
              <>
                <UsersTable
                  users={users}
                  currentUserId={session.user.id}
                  onView={handleViewUser}
                  onEdit={handleEditUser}
                  onDelete={handleDeleteUser}
                />

                <div className="mt-4 flex items-center justify-end">
                  {hasMore ? (
                    <Button onClick={loadMore} disabled={isLoading} variant="outline" className="flex items-center gap-2">
                      {isLoading ? (<><Loader2 className="h-4 w-4 animate-spin" /> Loading...</>) : ('Load More')}
                    </Button>
                  ) : (
                    <div className="text-sm text-muted-foreground">All users loaded</div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>

      <UserDialog
        isOpen={dialogState.isOpen}
        onClose={() => setDialogState(s => ({ ...s, isOpen:false }))}
        onSuccess={() => { /* setelah create/edit → biar sederhana reload awal via route refresh */ location.reload() }}
        user={dialogState.user}
        mode={dialogState.mode}
      />

      <Dialog open={deleteDialog.isOpen} onOpenChange={() => setDeleteDialog({ isOpen:false, user:null, isDeleting:false })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteDialog.user?.fullName}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteDialog({ isOpen:false, user:null, isDeleting:false })} disabled={deleteDialog.isDeleting}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteDialog.isDeleting}>
              {deleteDialog.isDeleting ? (<><Loader2 className="h-4 w-4 animate-spin mr-2" /> Deleting...</>) : ('Delete User')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
