// src/app/detection/page.tsx
import FishDetection from '@/components/FishDetection'

export default function DetectionPage() {
  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">
          🐟 Fish Detection AI System
        </h1>
        <FishDetection />
      </div>
    </div>
  )
}