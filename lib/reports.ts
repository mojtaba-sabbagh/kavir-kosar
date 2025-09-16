// lib/reports.ts
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

// Can the current user view this report?
export async function canReadReport(reportCodeUpper: string): Promise<boolean> {
  const user = await getSession();
  if (!user?.id) return false;

  const report = await prisma.report.findFirst({
    where: { code: reportCodeUpper },
    select: { id: true },
  });
  if (!report) return false;

  const roleIds = (await prisma.userRole.findMany({
    where: { userId: user.id },
    select: { roleId: true },
  })).map(r => r.roleId);

  if (roleIds.length === 0) return false;

  const perm = await prisma.roleReportPermission.findFirst({
    where: {
      reportId: report.id,
      roleId: { in: roleIds },
      canView: true,
    },
  });

  return !!perm;
}

// Throw if the user cannot view the report
export async function requireReportView(reportCodeUpper: string): Promise<void> {
  const ok = await canReadReport(reportCodeUpper);
  if (!ok) {
    const user = await getSession();
    if (!user?.id) throw new Error('UNAUTHORIZED');
    throw new Error('FORBIDDEN');
  }
}

// List all reports the given user can view
export async function listReadableReports(userId: string) {
  const roleIds = (await prisma.userRole.findMany({
    where: { userId },
    select: { roleId: true },
  })).map(r => r.roleId);

  if (roleIds.length === 0) return [];

  const perms = await prisma.roleReportPermission.findMany({
    where: { roleId: { in: roleIds }, canView: true },
    select: { reportId: true },
  });
  const reportIds = Array.from(new Set(perms.map(p => p.reportId)));
  if (reportIds.length === 0) return [];

  const reports = await prisma.report.findMany({
    where: { id: { in: reportIds }, isActive: true },
    select: { id: true, code: true, titleFa: true, sortOrder: true, formId: true, url: true },
    orderBy: { sortOrder: 'asc' },
  });

  return reports;
}
