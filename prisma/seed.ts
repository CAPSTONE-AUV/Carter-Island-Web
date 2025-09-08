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

  console.log('✅ Admin user created:', {
    id: admin.id,
    email: admin.email,
    fullName: admin.fullName,
    role: admin.role,
    createdAt: formatIndonesianTime(admin.createdAt),
    updatedAt: formatIndonesianTime(admin.updatedAt),
  })

  console.log('✅ Regular user created:', {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    createdAt: formatIndonesianTime(user.createdAt),
    updatedAt: formatIndonesianTime(user.updatedAt),
  })

  console.log('✅ Additional test users created successfully')
  console.log(`🎉 Database seeding completed at ${formatIndonesianTime(getIndonesiaTime())}!`)
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