import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/rbac';

const roleSchema = z.object({ name: z.string().min(2) });

export async function POST(req: Request) {
  await requireAdmin();
  const body = await req.json();
  const parsed = roleSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ message: 'نام گروه نامعتبر است' }, { status: 422 });

  const role = await prisma.role.create({ data: { name: parsed.data.name } });
  return NextResponse.json({ role });
}
