import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/rbac';

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ message: 'دسترسی غیرمجاز' }, { status: 403 });
  }

  const { roleIds } = await req.json();
  const params = await ctx.params;
  await prisma.userRole.deleteMany({ where: { userId: params.id } });

  if (Array.isArray(roleIds) && roleIds.length > 0) {
    await prisma.userRole.createMany({
      data: roleIds.map((r: string) => ({ userId: params.id, roleId: r })),
    });
  }

  return NextResponse.json({ ok: true });
}
