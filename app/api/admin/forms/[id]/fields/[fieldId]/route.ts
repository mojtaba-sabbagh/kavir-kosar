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
    'text','textarea','number','date','datetime','select','multiselect','checkbox','file',
    'entryRef','entryRefMulti','kardexItem', 'tableSelect', 
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

  const formId = params.id;
  const fieldId = params.fieldId;
  const { key, labelFa, type, required, order, config } = parsed.data;

  // Load the current field to detect renames/type changes
  const current = await prisma.formField.findUnique({
    where: { id: fieldId },
    select: { id: true, key: true, type: true, formId: true },
  });
  if (!current || current.formId !== formId) {
    return NextResponse.json({ message: 'فیلد یافت نشد' }, { status: 404 });
  }

  // Prevent duplicate key in the same form
  const dup = await prisma.formField.findFirst({
    where: { formId, key, NOT: { id: fieldId } },
    select: { id: true },
  });
  if (dup) return NextResponse.json({ message: 'کلید تکراری است' }, { status: 409 });

  // Update field
  const field = await prisma.formField.update({
    where: { id: fieldId },
    data: { key, labelFa, type, required, order, config: config ?? {} },
  });

  // --- Keep FormKardexRule in sync on rename/type-change ---
  // If a form has a kardex rule and its codeKey/nameKey points to this field,
  // keep it updated when the field key changes, or clear it if type no longer valid.
  const rule = await prisma.formKardexRule.findUnique({ where: { formId } });
  if (rule) {
    const updates: Partial<typeof rule> = {};

    // If this field was the mapped codeKey and key changed
    if (rule.codeKey === current.key && key !== current.key) updates.codeKey = key;

    // If this field was the mapped nameKey and key changed
    if (rule.nameKey && rule.nameKey === current.key && key !== current.key) updates.nameKey = key;

    // If this field was the mapped codeKey but the type is no longer kardexItem, unset it
    if (rule.codeKey === key && type !== 'kardexItem') updates.codeKey = undefined as any;

    // If this field was the mapped nameKey and you removed/changed it, unset it (allowed)
    if (rule.nameKey && rule.nameKey === key && type === 'kardexItem' /* still fine */) {
      // keep as-is
    }

    if (Object.keys(updates).length > 0) {
      // If both codeKey and qtyKey disappear later, you can also delete the rule entirely.
      await prisma.formKardexRule.update({
        where: { formId },
        data: updates as any,
      });
    }
  }
  // ---------------------------------------------------------

  return NextResponse.json({ field });
}

export async function DELETE(_req: Request, { params }: { params: { id: string; fieldId: string } }) {
  try { await requireAdmin(); } catch { return NextResponse.json({ message: 'دسترسی غیرمجاز' }, { status: 403 }); }
  const formId = params.id;
  const fieldId = params.fieldId;

  // Load the field to see whether it’s referenced by the kardex rule
  const fld = await prisma.formField.findUnique({
    where: { id: fieldId },
    select: { key: true, formId: true },
  });
  if (!fld || fld.formId !== formId) {
    return NextResponse.json({ message: 'فیلد یافت نشد' }, { status: 404 });
  }

  // If kardex rule references this key, unset it (or remove rule if incomplete)
  const rule = await prisma.formKardexRule.findUnique({ where: { formId } });
  if (rule) {
    let mustUpdate = false;
    const updates: any = {};
    if (rule.codeKey === fld.key) { updates.codeKey = undefined; mustUpdate = true; }
    if (rule.nameKey && rule.nameKey === fld.key) { updates.nameKey = undefined; mustUpdate = true; }

    if (mustUpdate) {
      // If after unsetting keys, the rule is invalid (no codeKey or no qtyKey),
      // you can remove it entirely to be safe.
      const stillValid = (updates.codeKey ?? rule.codeKey) && rule.qtyKey;
      if (!stillValid) {
        await prisma.formKardexRule.delete({ where: { formId } });
      } else {
        await prisma.formKardexRule.update({ where: { formId }, data: updates });
      }
    }
  }

  await prisma.formField.delete({ where: { id: fieldId } });
  return NextResponse.json({ ok: true });
}
