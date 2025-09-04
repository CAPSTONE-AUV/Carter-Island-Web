import { DefaultSession, DefaultUser } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      fullName: string
      email: string
      phoneNumber: string
      role: 'USER' | 'ADMIN'
    } & DefaultSession['user']
  }

  interface User extends DefaultUser {
    fullName: string
    phoneNumber: string
    role: 'USER' | 'ADMIN'
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    fullName: string
    phoneNumber: string
    role: 'USER' | 'ADMIN'
  }
}