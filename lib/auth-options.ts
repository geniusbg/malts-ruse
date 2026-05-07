import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { loginUser } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';

declare module 'next-auth' {
  interface User {
    role: string;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: string;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Rate limiting: 5 attempts per 15 minutes per IP/email
        const rateLimitKey = `login:${credentials.email}`;
        const rateLimitResult = rateLimit(rateLimitKey, 5, 15 * 60 * 1000);

        if (!rateLimitResult.allowed) {
          console.warn(`Rate limit exceeded for email: ${credentials.email}`);
          const minutesLeft = Math.ceil((rateLimitResult.resetTime - Date.now()) / 60000);
          // Използваме специален error code който NextAuth ще предаде на клиента
          throw new Error(
            `RATE_LIMIT_EXCEEDED:Твърде много опити за вход. Моля опитайте отново след ${minutesLeft} ${minutesLeft === 1 ? 'минута' : 'минути'}.`
          );
        }

        try {
          const user = await loginUser(credentials.email, credentials.password);

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          };
        } catch {
          // Don't reveal if email exists or not (security best practice)
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: '/bg/admin/login',
    error: '/bg/admin/login',
  },
  secret: (() => {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      throw new Error(
        'NEXTAUTH_SECRET must be set in environment variables. ' + 'Generate one with: openssl rand -base64 32'
      );
    }
    if (secret === 'dev-secret-change-in-production' || secret.length < 32) {
      throw new Error(
        'NEXTAUTH_SECRET must be a secure random string of at least 32 characters. ' +
          'Generate one with: openssl rand -base64 32'
      );
    }
    return secret;
  })(),
  // Use dynamic URL detection instead of hardcoded NEXTAUTH_URL
  // NextAuth will automatically detect the current host
};

