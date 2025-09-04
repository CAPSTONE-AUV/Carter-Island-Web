// src/app/dashboard/recordings/page.tsx
import { requireAuth } from '@/lib/auth-utils'
import Header from '@/components/layout/Header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default async function RecordingsPage() {
  await requireAuth()

  const recordings = [
    { id: 1, name: 'Mission_001_2024-01-15', duration: '00:15:30', size: '2.1 GB', date: '2024-01-15' },
    { id: 2, name: 'Mission_002_2024-01-14', duration: '00:23:45', size: '3.2 GB', date: '2024-01-14' },
    { id: 3, name: 'Mission_003_2024-01-13', duration: '00:08:12', size: '1.1 GB', date: '2024-01-13' },
  ]

  return (
    <>
      <Header title="Recordings" subtitle="Manage your AUV video recordings" />
      
      <main className="flex-1 overflow-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {recordings.map((recording) => (
                    <tr key={recording.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {recording.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {recording.duration}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {recording.size}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {recording.date}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <Button size="sm">Play</Button>
                        <Button variant="secondary" size="sm">Download</Button>
                        <Button variant="destructive" size="sm">Delete</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  )
}