// lib/auth.ts
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';

const COOKIE_NAME = 'session';
const SECRET = new TextEncoder().encode(process.env.AUTH_SECRET || 'dev-secret-change-me');

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
};

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({ user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET);

  const store = await cookies();                 // ⬅️ await
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession() {
  const store = await cookies();                 // ⬅️ await
  store.delete(COOKIE_NAME);
}

export async function getSessionFromCookie(token?: string) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as { user: SessionUser };
  } catch {
    return null;
  }
}

/**
 * In Server Components / Route Handlers call: await getSession()
 * In Middleware call: await getSession(req)
 */
export async function getSession(req?: NextRequest) {
  let token: string | undefined;

  if (req) {
    // Middleware path: NextRequest has a synchronous cookies store
    token = req.cookies.get(COOKIE_NAME)?.value;
  } else {
    // Server Component / Route Handler path: cookies() is async
    const store = await cookies();               // ⬅️ await
    token = store.get(COOKIE_NAME)?.value;
  }

  const payload = await getSessionFromCookie(token);
  return payload?.user ?? null;
}
