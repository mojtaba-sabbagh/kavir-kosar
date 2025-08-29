import { prisma } from '@/lib/db';
import ReportsPermEditor from './reports-perm-editor';

export default async function ReportPermsPage() {
  const [roles, reports, perms] = await Promise.all([
    prisma.role.findMany({ orderBy: { name: 'asc' } }),
    prisma.report.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.roleReportPermission.findMany(),
  ]);

  return (
    <div className="rounded-2xl border bg-white p-6">
      <h2 className="text-lg font-bold mb-4">مجوز گزارش‌ها (نقش × گزارش)</h2>
      <ReportsPermEditor roles={roles} reports={reports} perms={perms} />
    </div>
  );
}
