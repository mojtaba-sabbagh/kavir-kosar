import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(req: Request) {
  const me = await getSession();
  if (!me) return NextResponse.json({ message: 'no session' }, { status: 401 });

  const code = new URL(req.url).searchParams.get('code') || '';
  const rpt = await prisma.report.findFirst({ where: { OR: [{ code }, { code: `RPT:FORM:${code}` }] }, select: { id: true, code: true }});
  if (!rpt) return NextResponse.json({ message: 'no report' }, { status: 404 });

  const rows = await prisma.roleReportPermission.findMany({
    where: { reportId: rpt.id, canView: true, role: { users: { some: { userId: me.id } } } },
    select: { roleId: true },
  });

  return NextResponse.json({ me: me.id, report: rpt, canViewRolesCount: rows.length, roleIds: rows.map(r => r.roleId) });
}
