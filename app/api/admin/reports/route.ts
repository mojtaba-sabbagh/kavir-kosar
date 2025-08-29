import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/rbac';

const schema = z.object({
  code: z.string().min(2),
  titleFa: z.string().min(2),
  url: z.string().url().nullable().optional(),
  sortOrder: z.number().int().default(100),
  isActive: z.boolean().default(true),
});

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try { await requireAdmin(); } catch (e:any) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز' }, { status: e?.message === 'UNAUTHORIZED' ? 401 : 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ message: 'ورودی نامعتبر' }, { status: 422 });

  const exists = await prisma.report.findUnique({ where: { code: parsed.data.code } });
  if (exists) return NextResponse.json({ message: 'کد گزارش تکراری است' }, { status: 409 });

  const report = await prisma.report.create({ data: parsed.data });
  return NextResponse.json({ report });
}
