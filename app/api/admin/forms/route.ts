import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/rbac';
import { z } from 'zod';

const schema = z.object({
  code: z.string().min(2),
  titleFa: z.string().min(2),
  sortOrder: z.number().int().default(100),
  isActive: z.boolean().default(true),
});

export async function POST(req: Request) {
  try { await requireAdmin(); } catch { return NextResponse.json({ message: 'دسترسی غیرمجاز' }, { status: 403 }); }
  const body = await req.json().catch(()=>null);
  const p = schema.safeParse(body);
  if (!p.success) return NextResponse.json({ message: 'ورودی نامعتبر' }, { status: 422 });

  const exists = await prisma.form.findUnique({ where: { code: p.data.code } });
  if (exists) return NextResponse.json({ message: 'کد فرم تکراری است' }, { status: 409 });

  const f = await prisma.form.create({ data: p.data });
  return NextResponse.json({ id: f.id });
}
