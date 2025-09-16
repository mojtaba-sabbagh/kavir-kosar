// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth-edge';

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Only "/" and "/admin/*" are protected (enforced by matcher below)
  const protectedPaths = ['/', '/admin'];
  const isProtected =
    protectedPaths.some(p => pathname === p || pathname.startsWith(`${p}/`));

  if (!isProtected) return NextResponse.next();

  const session = await getSessionFromRequest(req);
  if (session) return NextResponse.next();

  // Preserve full path + query in ?next=...
  const url = req.nextUrl.clone();
  url.pathname = '/auth/sign-in';
  // build ?next from the original path + its query string
  const nextTarget = pathname + (search || '');
  url.search = '';
  url.searchParams.set('next', nextTarget || '/');
  return NextResponse.redirect(url);
}

// Run middleware only where we actually need it.
// This also avoids touching /api, /_next, /favicon.ico, /logo.png, etc.
export const config = {
  matcher: ['/', '/admin/:path*'],
};
