/** @file GoogleサインインのAPI Route。NextAuthが`/api/auth/*`の全経路をこの1つで処理する。 */
import NextAuth from 'next-auth'
import { authOption } from '@/lib/auth'

const handler = NextAuth(authOption)

export { handler as GET, handler as POST }
