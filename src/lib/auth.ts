import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import { TimezoneUtil } from './timezone'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required')
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email }
          })

          if (!user) {
            console.log(`[${TimezoneUtil.getTimestamp()}] Login failed - User not found: ${credentials.email}`)
            throw new Error('User not found')
          }

          const isPasswordValid = await bcrypt.compare(credentials.password, user.password)
          
          if (!isPasswordValid) {
            console.log(`[${TimezoneUtil.getTimestamp()}] Login failed - Invalid password: ${credentials.email}`)
            throw new Error('Invalid password')
          }

          // Update updatedAt untuk tracking login terakhir
          await prisma.user.update({
            where: { id: user.id },
            data: { 
              updatedAt: TimezoneUtil.now()
            }
          })

          console.log(`[${TimezoneUtil.getTimestamp()}] Login successful: ${user.email} (${user.role})`)

          return {
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            phoneNumber: user.phoneNumber,
            role: user.role
          }
        } catch (error) {
          console.error(`[${TimezoneUtil.getTimestamp()}] Auth error:`, error)
          throw error
        }
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    maxAge: 24 * 60 * 60, // 24 hours
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.fullName = (user as any).fullName
        token.email = user.email
        token.phoneNumber = (user as any).phoneNumber
        token.role = (user as any).role
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.fullName = token.fullName as string
        session.user.email = token.email as string
        session.user.phoneNumber = token.phoneNumber as string
        session.user.role = token.role as 'USER' | 'ADMIN'
      }
      return session
    }
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
  },
  secret: process.env.NEXTAUTH_SECRET,
}