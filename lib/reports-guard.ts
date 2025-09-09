import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function requireReportView(reportCodeOrFormCode: string) {
  const me = await getSession();
  if (!me) throw new Error('UNAUTHORIZED');

  // Accept either the exact report code or a form code (we store as RPT:FORM:<FORM_CODE>)
  const rpt = await prisma.report.findFirst({
    where: { OR: [{ code: reportCodeOrFormCode }, { code: `RPT:FORM:${reportCodeOrFormCode}` }] },
    select: { id: true, code: true },
  });
  if (!rpt) throw new Error('NOT_FOUND');

  const ok = await prisma.roleReportPermission.count({
    where: {
      reportId: rpt.id,
      canView: true,
      role: { users: { some: { userId: me.id } } },
    },
  });

  if (!ok) throw new Error('FORBIDDEN');

  return rpt;
}
