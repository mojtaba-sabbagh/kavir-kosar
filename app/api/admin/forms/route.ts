import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/rbac';

const formSchema = z.object({
  code: z.string().min(2),
  titleFa: z.string().min(2),
  sortOrder: z.number().int().default(100),
  isActive: z.boolean().default(true),
});

export async function POST(req: Request) {
  await requireAdmin();
  const body = await req.json();
  const parsed = formSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ message: 'ورودی نامعتبر' }, { status: 422 });

  const exists = await prisma.form.findUnique({ where: { code: parsed.data.code } });
  if (exists) return NextResponse.json({ message: 'کد فرم تکراری است' }, { status: 409 });

  const form = await prisma.form.create({ data: parsed.data });
  return NextResponse.json({ form });
}
