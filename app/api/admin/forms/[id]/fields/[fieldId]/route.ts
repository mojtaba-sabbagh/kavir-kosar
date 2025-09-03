// app/api/admin/forms/[id]/fields/[fieldId]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/rbac';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FieldUpdate = z.object({
  key: z.string().min(1),
  labelFa: z.string().min(1),
  type: z.enum([
    'text','textarea','number','date','datetime','select','multiselect','checkbox','file','entryRef','entryRefMulti'
  ] as const),
  required: z.boolean(),
  order: z.preprocess(v => typeof v==='string'? Number(v): v, z.number().int()),
  config: z.any().optional(),
});

export async function PUT(req: Request, { params }: { params: { id: string; fieldId: string } }) {
  try { await requireAdmin(); } catch { return NextResponse.json({ message: 'دسترسی غیرمجاز' }, { status: 403 }); }
  const body = await req.json().catch(() => null);
  const parsed = FieldUpdate.safeParse(body);
  if (!parsed.success) return NextResponse.json({ message: ' ورودی نامعتبر' }, { status: 422 });

  const { key, labelFa, type, required, order, config } = parsed.data;

  // prevent duplicate key in same form
  const dup = await prisma.formField.findFirst({
    where: { formId: params.id, key, NOT: { id: params.fieldId } },
  });
  if (dup) return NextResponse.json({ message: 'کلید تکراری است' }, { status: 409 });

  const field = await prisma.formField.update({
    where: { id: params.fieldId },
    data: { key, labelFa, type, required, order, config: config ?? {} },
  });
  return NextResponse.json({ field });
}

export async function DELETE(_req: Request, { params }: { params: { fieldId: string } }) {
  try { await requireAdmin(); } catch { return NextResponse.json({ message: 'دسترسی غیرمجاز' }, { status: 403 }); }
  await prisma.formField.delete({ where: { id: params.fieldId } });
  return NextResponse.json({ ok: true });
}
