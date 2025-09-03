// lib/rbac.ts
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export async function isAdmin(): Promise<boolean> {
  const user = await getSession();
  if (!user) return false;
  const count = await prisma.userRole.count({
    where: { userId: user.id, role: { name: 'admin' } },
  });
  return count > 0;
}

/**
 * Use in Server Components/layouts/pages.
 * Not logged in → redirects to sign-in; Logged in but not admin → redirects to /403.
 */
export async function requireAdminOrRedirect(target = '/admin') {
  const user = await getSession();
  if (!user) redirect(`/auth/sign-in?next=${encodeURIComponent(target)}`);
  const hasAdmin = await prisma.userRole.count({
    where: { userId: user!.id, role: { name: 'admin' } },
  });
  if (!hasAdmin) redirect('/403');
}

/**
 * Use in API routes / server actions.
 * Throws on unauthenticated/forbidden so you can map to 401/403 yourself.
 */
export async function requireAdmin(): Promise<void> {
  const user = await getSession();
  if (!user) {
    // unauthenticated
    throw new Error('UNAUTHORIZED');
  }
  const hasAdmin = await prisma.userRole.count({
    where: { userId: user.id, role: { name: 'admin' } },
  });
  if (!hasAdmin) {
    // authenticated but forbidden
    throw new Error('FORBIDDEN');
  }
}