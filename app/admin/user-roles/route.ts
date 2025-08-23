import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/rbac';
import { z } from 'zod';

const schema = z.object({ userId: z.string(), roleId: z.string() });

export async function POST(req: Request) {
  await requireAdmin();
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ message: 'ورودی نامعتبر' }, { status: 422 });

  const { userId, roleId } = parsed.data;
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId, roleId } },
    update: {},
    create: { userId, roleId },
  });
  return NextResponse.json({ ok: true });
}
