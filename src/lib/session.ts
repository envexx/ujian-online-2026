import { getIronSession, IronSession, SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';

export interface SessionData {
  userId?: string;
  email?: string;
  role?: 'ADMIN' | 'GURU' | 'SISWA' | 'SUPERADMIN';
  schoolId?: string; // Tenant ID - null for SUPERADMIN
  isLoggedIn?: boolean;
}

// Validate SESSION_SECRET
if (!process.env.SESSION_SECRET) {
  console.error('⚠️  WARNING: SESSION_SECRET tidak dikonfigurasi di environment variable!');
  console.error('   Session security akan lemah. Pastikan untuk mengatur SESSION_SECRET di .env');
}

// Fallback secret — MUST be at least 32 characters for iron-session
const SESSION_PASSWORD = process.env.SESSION_SECRET
  || (process.env.NODE_ENV === 'development'
    ? 'dev-secret-key-minimum-32-chars-long-for-iron-session'
    : 'CHANGE-THIS-IN-PRODUCTION-minimum-32-chars-long!!');

export const sessionOptions: SessionOptions = {
  password: SESSION_PASSWORD,
  cookieName: 'e-learning-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 60 * 60 * 8, // 8 hours - Rolling session (auto-refresh on activity)
    sameSite: 'lax',
  },
  ttl: 60 * 60 * 8, // Time to live: 8 hours (will be refreshed on each request)
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

// Helper to refresh session on activity (rolling session)
export async function refreshSession() {
  const session = await getSession();
  if (session.isLoggedIn) {
    // Touching session will automatically refresh the maxAge/ttl
    await session.save();
  }
  return session;
}

export async function createSession(data: Omit<SessionData, 'isLoggedIn'>) {
  const session = await getSession();
  session.userId = data.userId;
  session.email = data.email;
  session.role = data.role;
  session.schoolId = data.schoolId;
  session.isLoggedIn = true;
  await session.save();
}

export async function destroySession() {
  const session = await getSession();
  session.destroy();
}
