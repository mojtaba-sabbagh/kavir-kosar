import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/rbac';
import { z } from 'zod';

const MatrixSchema = z.record(z.string(), z.boolean());

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try { await requireAdmin(); } catch (e:any) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز' }, { status: e?.message === 'UNAUTHORIZED' ? 401 : 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = z.object({ matrix: MatrixSchema }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ message: 'ورودی نامعتبر' }, { status: 422 });

  const ops = Object.entries(parsed.data.matrix).map(([k, canView]) => {
    const [roleId, reportId] = k.split(':');
    return prisma.roleReportPermission.upsert({
      where: { roleId_reportId: { roleId, reportId } },
      update: { canView },
      create: { roleId, reportId, canView },
    });
  });

  await prisma.$transaction(ops);
  return NextResponse.json({ ok: true });
}
