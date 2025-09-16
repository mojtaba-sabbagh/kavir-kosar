// lib/auth-edge.ts
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

export type SessionUser = { id: string; email: string; name: string | null };

function edgeSecret(): Uint8Array {
  const s = process.env.SESSION_SECRET?.trim() ?? '';
  if (s.length < 32) {
    // Make misconfiguration obvious in middleware/edge
    throw new Error('SESSION_SECRET is missing or too short (min 32 chars) in edge runtime.');
  }
  return new TextEncoder().encode(s);
}

export async function getSessionFromRequest(req: NextRequest): Promise<SessionUser | null> {
  const token = req.cookies.get('session')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, edgeSecret());
    return {
      id: String(payload.sub ?? ''),
      email: String(payload.email ?? ''),
      name: (payload.name as string) ?? null,
    };
  } catch {
    return null;
  }
}
