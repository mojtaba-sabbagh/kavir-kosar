import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/rbac';
import { z } from 'zod';
import { ensureReportForForm } from '@/lib/report-sync';

const KardexSchema = z.object({
  codeKey: z.string().min(1),        // the FormField.key that holds کالا کد
  qtyKey: z.string().min(1),         // the FormField.key that holds مقدار
  nameKey: z.string().optional(),    // optional: if you want to auto-create item names
  mode: z.enum(['delta','set']).default('delta'),
  allowNegative: z.boolean().default(false),
  createIfMissing: z.boolean().default(false),
}).partial().refine(
  // if any kardex props are present, codeKey and qtyKey must be present
  (v) => {
    const anyProvided = Object.values(v).some(x => x !== undefined);
    return !anyProvided || (!!v.codeKey && !!v.qtyKey);
  },
  { message: 'برای اتصال به کاردکس، فیلدهای codeKey و qtyKey الزامی است.' }
);

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try { await requireAdmin(); } catch { return NextResponse.json({ message: 'دسترسی غیرمجاز' }, { status: 403 }); }
  const { id } = await ctx.params;

  const body = await req.json().catch(()=>null);
  const p = z.object({
    titleFa: z.string().min(2),
    sortOrder: z.number().int().default(100),
    isActive: z.boolean().default(true),
    // NEW: optional kardex mapping
    kardex: KardexSchema.optional(),
    // Optional: allow removing the rule explicitly
    removeKardex: z.boolean().optional().default(false),
  }).safeParse(body);

  if (!p.success) return NextResponse.json({ message: 'ورودی نامعتبر' }, { status: 422 });

  // update form meta (existing behavior)
  await prisma.form.update({ where: { id }, data: {
    titleFa: p.data.titleFa,
    sortOrder: p.data.sortOrder,
    isActive: p.data.isActive,
  }});

  // Upsert / delete Kardex rule if requested ---
  if (p.data.removeKardex === true) {
    await prisma.formKardexRule.deleteMany({ where: { formId: id } });
  } else if (p.data.kardex && p.data.kardex.codeKey && p.data.kardex.qtyKey) {
    const { codeKey, qtyKey, nameKey, mode = 'delta', allowNegative = false, createIfMissing = false } = p.data.kardex;
    await prisma.formKardexRule.upsert({
      where: { formId: id },
      update: { codeKey, qtyKey, nameKey, mode, allowNegative, createIfMissing },
      create: { formId: id, codeKey, qtyKey, nameKey, mode, allowNegative, createIfMissing },
    });
  }
  // -----------------------------------------------------
  await ensureReportForForm(id);
  
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  try { await requireAdmin(); } catch { return NextResponse.json({ message: 'دسترسی غیرمجاز' }, { status: 403 }); }
  const { id } = await props.params;

  try {
    await prisma.form.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: 'خطا در حذف فرم' }, { status: 500 });
  }
}
