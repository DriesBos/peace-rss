import 'server-only';

import { betterAuth } from 'better-auth';
import { hashPassword, verifyPassword } from 'better-auth/crypto';
import { nextCookies } from 'better-auth/next-js';
import bcrypt from 'bcryptjs';
import { headers } from 'next/headers';
import { authPool } from '@/lib/authDb';
import { sendPasswordResetEmail, sendVerificationEmail } from '@/lib/authEmail';

const DAY = 60 * 60 * 24;

export const auth = betterAuth({
  appName: 'Komorebi Reader',
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: authPool,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    revokeSessionsOnPasswordReset: true,
    password: {
      // New passwords use Better Auth's default (scrypt). Users migrated from
      // Clerk keep their bcrypt hash until they next change their password.
      hash: hashPassword,
      verify: async ({ hash, password }) => {
        if (hash.startsWith('$2')) {
          return bcrypt.compare(password, hash);
        }
        return verifyPassword({ hash, password });
      },
    },
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail(user.email, url);
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail(user.email, url);
    },
  },
  session: {
    // 90-day sliding session: each day of use pushes expiry 90 days out.
    expiresIn: 90 * DAY,
    updateAge: DAY,
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;

/** The current session in a Server Component or route handler, or null. */
export async function getSession(): Promise<Session | null> {
  return auth.api.getSession({ headers: await headers() });
}
