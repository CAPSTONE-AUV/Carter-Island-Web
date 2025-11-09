// src/app/dashboard/recordings/page.tsx
import { requireAuth } from '@/lib/auth-utils'
import Header from '@/components/layout/Header'
import { Card, CardContent } from '@/components/ui/card'
import { prisma } from '@/lib/prisma'
import RecordingsTable from '@/components/RecordingsTable'

export default async function RecordingsPage() {
  await requireAuth()

  // Fetch recordings from database
  const recordings = await prisma.recording.findMany({
    orderBy: {
      startTime: 'desc'
    },
    take: 50 // Limit to 50 most recent recordings
  })

  return (
    <>
      <Header title="Recordings" subtitle="Manage AUV Video Recordings" emoji="📹"/>

      <main className="p-0 lg:px-4 mt-4">
        <Card>
          <CardContent className="p-6">
            <RecordingsTable recordings={recordings} />
          </CardContent>
        </Card>
      </main>
    </>
  )
}
