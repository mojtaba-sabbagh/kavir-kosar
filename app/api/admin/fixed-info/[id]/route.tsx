// app/api/admin/fixed-info/[id]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> } // <-- params is a Promise
) {
  await requireAdmin();
  const { id } = await ctx.params;

  const row = await prisma.fixedInformation.findUnique({ where: { id } });
  if (!row) {
    return NextResponse.json({ message: 'یافت نشد' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, row });
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> } 
) {
  await requireAdmin();
  const { id } = await ctx.params;

  const body = await req.json().catch(() => ({}));
  // Expecting { code?, title?, type?, description? }
  const updated = await prisma.fixedInformation.update({
    where: { id },
    data: {
      code: body.code ?? undefined,
      title: body.title ?? undefined,
      type: body.type ?? undefined,
      description: body.description ?? undefined,
    },
  });

  return NextResponse.json({ ok: true, row: updated });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> } // <-- params is a Promise
) {
  await requireAdmin();
  const { id } = await ctx.params;

  await prisma.fixedInformation.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
