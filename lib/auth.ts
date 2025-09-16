// lib/auth.ts (server-only)
import { cookies, headers } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';

const COOKIE = 'session';

function getSecret(): Uint8Array {
  const s = process.env.SESSION_SECRET?.trim() ?? '';
  if (s.length < 32) {
    throw new Error('SESSION_SECRET is missing or too short (min 32 chars).');
  }
  return new TextEncoder().encode(s);
}

// ✅ headers() is async in Next 15
const isSecure = async (): Promise<boolean> => {
  const h = await headers();
  const proto = h.get('x-forwarded-proto') ?? 'http';
  return proto === 'https';
};

export async function createSession(p: { id: string; email: string; name: string | null }) {
  const token = await new SignJWT({ sub: p.id, email: p.email, name: p.name })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getSecret());

  // ✅ cookies() is async in Next 15
  const store = await cookies();
  const secure = await isSecure();

  store.set({
    name: COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure,          // only set Secure on HTTPS
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destroySession() {
  const store = await cookies();
  const secure = await isSecure();

  store.set({
    name: COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    expires: new Date(0),
  });
}

export async function getSession(): Promise<{ id: string; email: string; name: string | null } | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      id: String(payload.sub ?? ''),
      email: String(payload.email ?? ''),
      name: (payload.name as string) ?? null,
    };
  } catch {
    return null;
  }
}
