import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/rbac';
import { z } from 'zod';

export async function PUT(_req: Request, props: { params: Promise<{ id: string }> }) {
  try { await requireAdmin(); } catch { return NextResponse.json({ message: 'دسترسی غیرمجاز' }, { status: 403 }); }
  const { id } = await props.params;
  const body = await _req.json().catch(()=>null);
  const p = z.object({
    titleFa: z.string().min(2),
    sortOrder: z.number().int().default(100),
    isActive: z.boolean().default(true),
  }).safeParse(body);
  if (!p.success) return NextResponse.json({ message: 'ورودی نامعتبر' }, { status: 422 });

  await prisma.form.update({ where: { id }, data: p.data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ message: 'دسترسی غیرمجاز' }, { status: 403 });
  }

  const { id } = await props.params;

  try {
    await prisma.form.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ message: 'خطا در حذف فرم' }, { status: 500 });
  }
}