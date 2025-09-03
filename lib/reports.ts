// lib/reports.ts
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function canReadReport(code: string) {
  const user = await getSession();
  if (!user) return false;

  // 1) find roleIds for this user
  const userRoles = await prisma.userRole.findMany({
    where: { userId: user.id },
    select: { roleId: true },
  });
  const roleIds = userRoles.map(r => r.roleId);
  if (roleIds.length === 0) return false;

  // 2) check permission via RoleReportPermission.canView
  const count = await prisma.roleReportPermission.count({
    where: {
      roleId: { in: roleIds },
      canView: true,               // <-- schema uses canView
      report: { code },            // ensure it’s the requested report
    },
  });
  return count > 0;
}

export async function requireReportRead(code: string) {
  const ok = await canReadReport(code);
  if (!ok) {
    const err = new Error('UNAUTHORIZED');
    (err as any).code = 403;
    throw err;
  }
}

export async function listReadableReports() {
  const user = await getSession();
  if (!user) return [];

  // 1) roleIds
  const userRoles = await prisma.userRole.findMany({
    where: { userId: user.id },
    select: { roleId: true },
  });
  const roleIds = userRoles.map(r => r.roleId);
  if (roleIds.length === 0) return [];

  // 2) fetch distinct reports for these roles where canView = true
  const perms = await prisma.roleReportPermission.findMany({
    where: {
      roleId: { in: roleIds },
      canView: true,            // <-- use canView
    },
    select: {
      report: { select: { id: true, code: true, titleFa: true, sortOrder: true } },
    },
    orderBy: [
      { report: { sortOrder: 'asc' } },
      { report: { titleFa: 'asc' } },
    ],
  });

  // Deduplicate by report.id
  const seen = new Set<string>();
  const reports: { id: string; code: string; titleFa: string; sortOrder: number | null }[] = [];
  for (const p of perms) {
    const r = p.report;
    if (!r) continue;
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    reports.push(r);
  }
  return reports;
}
