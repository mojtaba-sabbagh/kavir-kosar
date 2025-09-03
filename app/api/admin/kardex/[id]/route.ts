import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/rbac';
import { z } from 'zod';

export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  try { await requireAdmin(); } catch { return NextResponse.json({ message: 'دسترسی غیرمجاز' }, { status: 403 }); }
  const { id } = await props.params;
  const body = await req.json().catch(()=>null);
  const schema = z.object({
    nameFa: z.string().min(1).optional(),
    category: z.string().optional().nullable(),
    unit: z.string().optional().nullable(),
    openingQty: z.number().optional().nullable(),
    openingValue: z.number().optional().nullable(),
    currentQty: z.number().optional().nullable(),
    currentValue: z.number().optional().nullable(),
  });
  const p = schema.safeParse(body);
  if (!p.success) return NextResponse.json({ message: 'ورودی نامعتبر' }, { status: 422 });

  await prisma.kardexItem.update({ where: { id }, data: p.data as any });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  try { await requireAdmin(); } catch { return NextResponse.json({ message: 'دسترسی غیرمجاز' }, { status: 403 }); }
  const { id } = await props.params;
  await prisma.kardexItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
