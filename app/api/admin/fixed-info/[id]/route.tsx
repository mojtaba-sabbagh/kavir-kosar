import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/rbac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(req: Request, ctx: { params: { id: string } }) {
  try { await requireAdmin(); } catch { return NextResponse.json({ message: 'دسترسی غیرمجاز' }, { status: 403 }); }
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body || !body.code || !body.title || !body.type) {
    return NextResponse.json({ ok: false, message: 'کد، عنوان و نوع ضروری است' }, { status: 422 });
  }
  const row = await prisma.fixedInformation.update({
    where: { id },
    data: { code: body.code, title: body.title, type: body.type, description: body.description ?? null },
  });
  return NextResponse.json({ ok: true, row });
}

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  try { await requireAdmin(); } catch { return NextResponse.json({ message: 'دسترسی غیرمجاز' }, { status: 403 }); }
  const { id } = await ctx.params;
  await prisma.fixedInformation.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
