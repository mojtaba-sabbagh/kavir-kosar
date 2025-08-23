// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow these paths
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/public')
  ) return NextResponse.next();

  // Protect home (/) and admin
  const protectedPaths = ['/', '/admin'];
  const isProtected =
    protectedPaths.some(p => pathname === p || pathname.startsWith(`${p}/`));

  if (!isProtected) return NextResponse.next();

  const session = await getSession(req);
  if (!session) {
    const signInUrl = new URL('/auth/sign-in', req.url);
    signInUrl.searchParams.set('next', pathname || '/');
    return NextResponse.redirect(signInUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/admin/:path*'],
};
