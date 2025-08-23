// app/api/auth/logout/route.ts
import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/auth';

export const runtime = 'nodejs';          // prisma/cookies need Node.js, not edge
export const dynamic = 'force-dynamic';   // avoid static optimization

export async function POST(req: Request) {
  await destroySession();                 // this awaits cookies() internally
  // redirect back to sign-in (or home)
  const url = new URL(req.url);
  url.pathname = '/auth/sign-in';
  url.search = '';
  return NextResponse.redirect(url);
}
