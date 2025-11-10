import { PrismaClient, Role } from '@prisma/client'
import bcrypt from 'bcryptjs'
import moment from 'moment-timezone'

const prisma = new PrismaClient()

// Function untuk mendapatkan waktu Indonesia
const getIndonesiaTime = () => {
  return moment().tz('Asia/Jakarta').toDate()
}

const formatIndonesianTime = (date: Date) => {
  return moment(date).tz('Asia/Jakarta').format('DD-MM-YYYY HH:mm:ss WIB')
}

async function main() {
  const currentTime = getIndonesiaTime()

  console.log('🌱 Starting database seeding...')
  console.log(`⏰ Current Indonesia Time: ${formatIndonesianTime(currentTime)}`)

  // Hash password
  const hashedPassword = await bcrypt.hash('kikipoiu', 12)

  // ========================================
  // SEED USERS
  // ========================================
  console.log('\n👤 Seeding users...')

  // Create Admin User
  const admin = await prisma.user.upsert({
    where: { email: 'admin@carterisland.com' },
    update: {
      updatedAt: currentTime
    },
    create: {
      email: 'admin@carterisland.com',
      fullName: 'Carter Island Administrator',
      password: hashedPassword,
      phoneNumber: '+62-812-3456-7890',
      role: Role.ADMIN,
      createdAt: currentTime,
      updatedAt: currentTime,
    },
  })

  // Create Regular User
  const user = await prisma.user.upsert({
    where: { email: 'user@carterisland.com' },
    update: {
      updatedAt: currentTime
    },
    create: {
      email: 'user@carterisland.com',
      fullName: 'Carter Island User',
      password: hashedPassword,
      phoneNumber: '+62-812-3456-7891',
      role: Role.USER,
      createdAt: currentTime,
      updatedAt: currentTime,
    },
  })

  // Create additional test users
  const testUsers = [
    {
      email: 'john.doe@carterisland.com',
      fullName: 'John Doe',
      phoneNumber: '+62-812-1111-1111',
      role: Role.USER,
    },
    {
      email: 'jane.smith@carterisland.com',
      fullName: 'Jane Smith',
      phoneNumber: '+62-812-2222-2222',
      role: Role.USER,
    },
    {
      email: 'supervisor@carterisland.com',
      fullName: 'AUV Supervisor',
      phoneNumber: '+62-812-9999-9999',
      role: Role.ADMIN,
    }
  ]

  // Insert additional users
  for (const testUser of testUsers) {
    await prisma.user.upsert({
      where: { email: testUser.email },
      update: {
        updatedAt: currentTime
      },
      create: {
        ...testUser,
        password: hashedPassword,
        createdAt: currentTime,
        updatedAt: currentTime,
      }
    })
  }

  console.log('✅ Created 5 users (2 admins, 3 regular users)')

  // ========================================
  // SEED TELEMETRY DATA (Last 48 hours)
  // ========================================
  console.log('\n📊 Seeding telemetry data...')

  const telemetryRecords = []
  const now = getIndonesiaTime()

  // Create 100 telemetry records over the past 48 hours
  for (let i = 0; i < 100; i++) {
    // Create timestamp going backward (30 minute intervals)
    const minutesAgo = i * 30
    const timestamp = moment(now).subtract(minutesAgo, 'minutes').toDate()

    // Simulate realistic AUV telemetry with some variation
    const baseRoll = Math.sin(i / 10) * 5 // Oscillating roll
    const basePitch = Math.cos(i / 10) * 3 // Oscillating pitch

    telemetryRecords.push({
      // Attitude data (simulated movement)
      rollDeg: baseRoll + (Math.random() * 2 - 1),
      pitchDeg: basePitch + (Math.random() * 2 - 1),
      yawDeg: (i * 3.6) % 360, // Slowly rotating
      // Compass data
      headingDeg: (i * 3.6 + 45) % 360,
      // Battery data (slowly depleting)
      voltageV: 14.8 - (i * 0.02), // 14.8V down to 12.8V
      currentA: 2.5 + Math.random() * 1.5, // 2.5-4A
      remainingPercent: Math.max(20, 100 - (i * 0.8)),
      consumedMah: i * 50, // Increasing consumption
      // Health status (mostly calibrated, occasional issues)
      gyroCal: Math.random() > 0.05, // 95% calibrated
      accelCal: Math.random() > 0.05,
      magCal: Math.random() > 0.1, // 90% calibrated
      timestamp,
      createdAt: timestamp,
    })
  }

  await prisma.telemetry.createMany({
    data: telemetryRecords,
  })

  console.log(`✅ Created ${telemetryRecords.length} telemetry records`)

  // ========================================
  // SEED AUV STATUS DATA
  // ========================================
  console.log('\n🤖 Seeding AUV status data...')

  const auvStatusRecords = []
  const firstConnectedTime = moment(now).subtract(72, 'hours').toDate() // Started 3 days ago

  for (let i = 0; i < 100; i++) {
    const minutesAgo = i * 30
    const timestamp = moment(now).subtract(minutesAgo, 'minutes').toDate()

    // 85% uptime simulation
    const isOnline = Math.random() > 0.15
    const uptimeSeconds = isOnline
      ? Math.floor((timestamp.getTime() - firstConnectedTime.getTime()) / 1000)
      : 0

    // Connection strength based on time pattern
    let connectionStrength = 'Offline'
    if (isOnline) {
      const rand = Math.random()
      if (rand > 0.7) connectionStrength = 'Strong'
      else if (rand > 0.3) connectionStrength = 'Moderate'
      else connectionStrength = 'Weak'
    }

    auvStatusRecords.push({
      isOnline,
      connectionStrength,
      uptimeSeconds,
      locationStatus: 'Active',
      lastStreamTime: isOnline ? timestamp : null,
      timestamp,
      createdAt: timestamp,
    })
  }

  await prisma.aUVStatus.createMany({
    data: auvStatusRecords,
  })

  console.log(`✅ Created ${auvStatusRecords.length} AUV status records`)

  // ========================================
  // SEED FISH DETECTION DATA
  // ========================================
  console.log('\n🐟 Seeding fish detection data...')

  const fishSpecies = [
    'Clownfish',
    'Blue Tang',
    'Grouper',
    'Red Snapper',
    'Yellowfin Tuna',
    'Barracuda',
    'Angelfish',
    'Butterflyfish',
    'Parrotfish',
    'Napoleon Wrasse',
    'Lionfish',
    'Moray Eel',
  ]

  const sessionIds = ['session_001', 'session_002', 'session_003']
  let totalDetections = 0

  // Create 150 fish detection events
  for (let i = 0; i < 150; i++) {
    const minutesAgo = i * 20 // Every 20 minutes
    const timestamp = moment(now).subtract(minutesAgo, 'minutes').toDate()
    const fishCount = Math.floor(Math.random() * 6) + 1 // 1-6 fish per frame
    const sessionId = sessionIds[Math.floor(Math.random() * sessionIds.length)]

    const fishDetection = await prisma.fishDetection.create({
      data: {
        sessionId,
        timestamp,
        fishCount,
        frameNumber: i * 30,
        imageUrl: `https://storage.carterisland.com/snapshots/frame_${String(i).padStart(5, '0')}.jpg`,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    })

    // Create detection details for each fish
    const detectionDetails = []
    for (let j = 0; j < fishCount; j++) {
      const species = fishSpecies[Math.floor(Math.random() * fishSpecies.length)]
      const confidence = 0.75 + Math.random() * 0.24 // 0.75 - 0.99 confidence

      // Random bounding box coordinates
      const x1 = Math.random() * 800
      const y1 = Math.random() * 600
      const width = 50 + Math.random() * 200
      const height = 50 + Math.random() * 200

      detectionDetails.push({
        detectionId: fishDetection.id,
        className: species,
        confidence,
        boundingBoxX1: x1,
        boundingBoxY1: y1,
        boundingBoxX2: x1 + width,
        boundingBoxY2: y1 + height,
        createdAt: timestamp,
      })
    }

    await prisma.detectionDetail.createMany({
      data: detectionDetails,
    })

    totalDetections += fishCount
  }

  console.log(`✅ Created 150 fish detections with ${totalDetections} individual fish detected`)

  // ========================================
  // SEED RECORDING DATA
  // ========================================
  console.log('\n🎥 Seeding recording data...')

  const recordings = []

  for (let i = 0; i < 15; i++) {
    const hoursAgo = (i + 1) * 6 // Every 6 hours
    const startTime = moment(now).subtract(hoursAgo, 'hours').toDate()

    // Random duration between 30-120 minutes
    const durationMinutes = 30 + Math.random() * 90
    const durationSeconds = durationMinutes * 60
    const endTime = moment(startTime).add(durationSeconds, 'seconds').toDate()

    // File size roughly proportional to duration (approx 2MB per minute)
    const fileSizeBytes = Math.floor(durationMinutes * 2 * 1024 * 1024)

    recordings.push({
      sessionId: sessionIds[i % sessionIds.length],
      filename: `recording_${String(i + 1).padStart(3, '0')}.mp4`,
      filepath: `/recordings/${sessionIds[i % sessionIds.length]}/recording_${String(i + 1).padStart(3, '0')}.mp4`,
      fileSize: BigInt(fileSizeBytes),
      duration: durationSeconds,
      startTime,
      endTime,
      createdAt: startTime,
      updatedAt: endTime,
    })
  }

  await prisma.recording.createMany({
    data: recordings,
  })

  console.log(`✅ Created ${recordings.length} recording records`)

  // ========================================
  // SUMMARY
  // ========================================
  console.log('\n' + '='.repeat(60))
  console.log('✨ Database seeding completed successfully!')
  console.log('='.repeat(60))
  console.log('\n📋 Summary:')
  console.log(`   • Users: 5 (2 admins, 3 regular users)`)
  console.log(`   • Telemetry: ${telemetryRecords.length} records (last 48 hours)`)
  console.log(`   • AUV Status: ${auvStatusRecords.length} records (last 48 hours)`)
  console.log(`   • Fish Detections: 150 events with ${totalDetections} fish`)
  console.log(`   • Recordings: ${recordings.length} videos`)
  console.log('\n🔐 Login credentials:')
  console.log('   Email: admin@carterisland.com')
  console.log('   Password: kikipoiu')
  console.log('\n⏰ Completed at:', formatIndonesianTime(getIndonesiaTime()))
  console.log('='.repeat(60) + '\n')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(`❌ Error during seeding at ${formatIndonesianTime(getIndonesiaTime())}:`, e)
    await prisma.$disconnect()
    process.exit(1)
  })