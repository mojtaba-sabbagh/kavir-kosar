// app/api/admin/forms/[id]/report-config/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/rbac';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  visibleColumns: z.array(z.string()).default([]),
  filterableKeys: z.array(z.string()).default([]),
  orderableKeys:  z.array(z.string()).default([]),
  defaultOrder:   z.object({ key: z.string(), dir: z.enum(['asc','desc']) }).optional(),
});

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try { await requireAdmin(); } catch { return NextResponse.json({ message: 'دسترسی غیرمجاز' }, { status: 403 }); }
  const { id: formId } = await ctx.params;

  const body = await req.json().catch(()=>null);
  const p = Body.safeParse(body);
  if (!p.success) return NextResponse.json({ message: 'ورودی نامعتبر' }, { status: 422 });

  // ensure there is a Report row for this form
  const existing = await prisma.report.findUnique({ where: { formId } });
  if (!existing) {
    await prisma.report.create({
      data: {
        formId,
        code: `RPT:FORM:${(await prisma.form.findUnique({ where: { id: formId }, select: { code:true } }))?.code ?? 'UNKNOWN'}`,
        titleFa: (await prisma.form.findUnique({ where: { id: formId }, select: { titleFa:true } }))?.titleFa ?? 'گزارش فرم',
        sortOrder: 100,
        visibleColumns: p.data.visibleColumns,
        filterableKeys: p.data.filterableKeys,
        orderableKeys: p.data.orderableKeys,
        ...(p.data.defaultOrder ? { defaultOrder: p.data.defaultOrder } : {}),
      }
    });
  } else {
    await prisma.report.update({
      where: { formId },
      data: {
        visibleColumns: p.data.visibleColumns,
        filterableKeys: p.data.filterableKeys,
        orderableKeys: p.data.orderableKeys,
        // only update defaultOrder if sent
        ...(p.data.defaultOrder ? { defaultOrder: p.data.defaultOrder } : {}),
      },
    });
  }

  return NextResponse.json({ ok: true });
}
