// /app/api/admin/kardex/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/rbac';
import { z } from 'zod';

export async function POST(req: Request) {
  // preserve: same auth + 403 shape
  try { await requireAdmin(); } catch { 
    return NextResponse.json({ message: 'دسترسی غیرمجاز' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);

  // preserve: same base schema fields and validation style
  const baseSchema = z.object({
    code: z.string().min(1),
    nameFa: z.string().min(1),
    category: z.string().optional().nullable(),
    unit: z.string().optional().nullable(),
    openingQty: z.number().optional().nullable(),
    openingValue: z.number().optional().nullable(),
    currentQty: z.number().optional().nullable(),
    currentValue: z.number().optional().nullable(),
  });

  // ✅ Extend with your new optional fields (انبار، نقطه سفارش، وزن واحد)
  const schema = baseSchema.extend({
    storage: z.string().optional().nullable(),             // انبار
    orderPoint: z.number().optional().nullable(),          // نقطه سفارش
    extra: z.object({                                      // وزن واحد داخل JSON
      weight: z.number().optional().nullable(),
    }).optional().nullable(),
  });

  const p = schema.safeParse(body);
  if (!p.success) {
    // preserve: same 422 + message
    return NextResponse.json({ message: 'ورودی نامعتبر' }, { status: 422 });
  }

  // preserve: same create + response shape
  // note: undefined keys are ignored by Prisma, so we keep the same semantics
  const data = {
    code: p.data.code,
    nameFa: p.data.nameFa,
    category: p.data.category ?? undefined,
    unit: p.data.unit ?? undefined,
    openingQty: p.data.openingQty ?? undefined,
    openingValue: p.data.openingValue ?? undefined,
    currentQty: p.data.currentQty ?? undefined,
    currentValue: p.data.currentValue ?? undefined,

    // newly persisted:
    storage: p.data.storage ?? undefined,
    orderPoint: p.data.orderPoint ?? undefined,
    extra: p.data.extra ?? undefined, // e.g. { weight: 2.5 } | {} | null | undefined
  };

  const item = await prisma.kardexItem.create({ data: data as any });
  return NextResponse.json({ ok: true, id: item.id });
}
