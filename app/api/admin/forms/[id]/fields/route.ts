// app/api/admin/forms/[id]/fields/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/rbac';
import { z } from 'zod';

const Field = z.object({
  id: z.string().uuid().optional(),
  key: z.string().min(1),
  labelFa: z.string().min(1),
  type: z.string().min(2),
  required: z.boolean(),
  order: z.number().int().default(0),
  config: z.any().optional(),
});
const Body = z.object({ fields: z.array(Field) });

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  try { await requireAdmin(); } catch { return NextResponse.json({ message: 'دسترسی غیرمجاز' }, { status: 403 }); }
  const { id: formId } = await props.params;

  const body = await req.json().catch(() => null);
  const p = Body.safeParse(body);
  if (!p.success) return NextResponse.json({ message: 'ورودی نامعتبر' }, { status: 422 });

  // Enforce unique keys inside this save
  const keys = p.data.fields.map(f => f.key);
  if (new Set(keys).size !== keys.length) {
    return NextResponse.json({ message: 'کلید فیلدها باید یکتا باشند' }, { status: 422 });
  }

  await prisma.$transaction(async (tx) => {
    // Load current fields for this form
    const existing = await tx.formField.findMany({
      where: { formId },
      select: { id: true, key: true },
    });
    const existingById = new Map(existing.map(e => [e.id, e]));
    const existingKeys = new Set(existing.map(e => e.key));

    // Upsert submitted fields
    for (const f of p.data.fields) {
      if (f.id && existingById.has(f.id)) {
        await tx.formField.update({
          where: { id: f.id },
          data: {
            key: f.key,
            labelFa: f.labelFa,
            type: f.type as any,
            required: f.required,
            order: f.order,
            config: f.config ?? undefined,
          },
        });
      } else {
        await tx.formField.create({
          data: {
            formId,
            key: f.key,
            labelFa: f.labelFa,
            type: f.type as any,
            required: f.required,
            order: f.order,
            config: f.config ?? undefined,
          },
        });
      }
    }

    // Delete fields that are no longer present (by KEY, not by id)
    const submittedKeySet = new Set(keys);
    const keysToDelete = [...existingKeys].filter(k => !submittedKeySet.has(k));
    if (keysToDelete.length) {
      await tx.formField.deleteMany({
        where: { formId, key: { in: keysToDelete } },
      });
    }
  });

  // Optional: bump form version
  await prisma.form.update({ where: { id: formId }, data: { version: { increment: 1 } } });

  return NextResponse.json({ ok: true });
}
