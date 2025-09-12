// scripts/test-db.js
import { PrismaClient } from '@prisma/client'
import 'dotenv/config'

async function testConnection() {
  try {
    console.log('🔍 Testing MySQL connection...')
    
    // Test connection
    await prisma.$connect()
    console.log('✅ Database connected successfully!')
    
    // Test detection table
    const detectionCount = await prisma.detection.count()
    console.log(`📊 Current detections in database: ${detectionCount}`)
    
    // Test fishDetection table
    const fishDetectionCount = await prisma.fishDetection.count()
    console.log(`🐟 Current fish detections: ${fishDetectionCount}`)
    
    // Test users table (existing)
    const userCount = await prisma.user.count()
    console.log(`👥 Current users: ${userCount}`)
    
    console.log('✅ All tables accessible!')
    
  } catch (error) {
    console.error('❌ Database connection failed:', error)
    
    // Specific error handling
    if (error.code === 'P2021') {
      console.error('🚨 Table does not exist. Run: npx prisma db push')
    }
    
  } finally {
    await prisma.$disconnect()
  }
}

testConnection()