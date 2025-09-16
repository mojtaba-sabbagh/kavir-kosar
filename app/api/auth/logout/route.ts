// app/api/auth/logout/route.ts
import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function originFrom(req: Request) {
  const h = req.headers;
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const host  = h.get('x-forwarded-host')  ?? h.get('host') ?? new URL(req.url).host;
  return `${proto}://${host}`;
}

export async function POST(req: Request) {
  await destroySession();
  const origin = originFrom(req);
  return NextResponse.redirect(new URL('/auth/sign-in', origin), 303); // ✅ correct host, correct method switch
}
