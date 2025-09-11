import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

// keep (or add) this helper
async function isAdmin(userId: string) {
  const c = await prisma.userRole.count({
    where: { userId, role: { name: 'admin' } },
  });
  return c > 0;
}

// already added earlier
export async function canReadReport(code: string) {
  const user = await getSession();
  if (!user?.id) return false;

  const report = await prisma.report.findFirst({
    where: { code: { equals: code, mode: 'insensitive' }, isActive: true },
    select: { id: true },
  });
  if (!report) return false;

  if (await isAdmin(user.id)) return true;

  const ok = await prisma.roleReportPermission.count({
    where: {
      reportId: report.id,
      canView: true,
      role: { userRoles: { some: { userId: user.id } } },
    },
  });

  return ok > 0;
}

// ✅ NEW: list reports the current user can view (for dashboard)
export async function listReadableReports() {
  const user = await getSession();
  if (!user?.id) return [];

  const baseSelect = {
    id: true,
    code: true,
    titleFa: true,
    sortOrder: true,
  } as const;

  // Admin sees all active reports
  if (await isAdmin(user.id)) {
    return prisma.report.findMany({
      where: { isActive: true },
      select: baseSelect,
      orderBy: [{ sortOrder: 'asc' }, { titleFa: 'asc' }],
    });
  }

  // Others: only reports granted via role memberships
  return prisma.report.findMany({
    where: {
      isActive: true,
      rolePermissions: {
        some: {
          canView: true,
          role: { userRoles: { some: { userId: user.id } } },
        },
      },
    },
    select: baseSelect,
    orderBy: [{ sortOrder: 'asc' }, { titleFa: 'asc' }],
  });
}
