import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/rbac';
import { z } from 'zod';

export async function POST(req: Request) {
  try { await requireAdmin(); } catch { return NextResponse.json({ message: 'دسترسی غیرمجاز' }, { status: 403 }); }
  const body = await req.json().catch(()=>null);

  const schema = z.object({
    code: z.string().min(1),
    nameFa: z.string().min(1),
    category: z.string().optional().nullable(),
    unit: z.string().optional().nullable(),
    openingQty: z.number().optional().nullable(),
    openingValue: z.number().optional().nullable(),
    currentQty: z.number().optional().nullable(),
    currentValue: z.number().optional().nullable(),
  });
  const p = schema.safeParse(body);
  if (!p.success) return NextResponse.json({ message: 'ورودی نامعتبر' }, { status: 422 });

  const item = await prisma.kardexItem.create({ data: p.data as any });
  return NextResponse.json({ ok: true, id: item.id });
}
