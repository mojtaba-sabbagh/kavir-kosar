// app/api/admin/permissions/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/rbac';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CellSchema = z.object({
  canRead: z.boolean().optional().default(false),
  canSubmit: z.boolean().optional().default(false),
  canConfirm: z.boolean().optional().default(false),
  canFinalConfirm: z.boolean().optional().default(false),
});

const MatrixSchema = z.record(z.string(), CellSchema);

export async function POST(req: Request) {
  // Auth (Farsi error)
  try {
    await requireAdmin();
  } catch (e: any) {
    const code = e?.message === 'UNAUTHORIZED' ? 401 : 403;
    return NextResponse.json({ message: 'دسترسی غیرمجاز' }, { status: code });
  }

  // Parse
  const body = await req.json().catch(() => null);
  const parsed = z.object({ matrix: MatrixSchema }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: 'ورودی نامعتبر' }, { status: 422 });
  }

  const incoming = parsed.data.matrix;

  // Normalize per cell with the rules:
  // final ⇒ confirm ⇒ read ; and !read ⇒ !submit & !confirm & !final
  const normalized: Record<
    string,
    { canRead: boolean; canSubmit: boolean; canConfirm: boolean; canFinalConfirm: boolean }
  > = {};

  for (const [key, v] of Object.entries(incoming)) {
    // Validate key "roleId:formId"
    if (!key.includes(':')) continue;
    const final = !!v.canFinalConfirm;
    const confirm = final ? true : !!v.canConfirm;
    const read = final || confirm || !!v.canSubmit || !!v.canRead;

    normalized[key] = {
      canRead: read,
      canSubmit: read ? !!v.canSubmit : false,
      canConfirm: read ? confirm : false,
      canFinalConfirm: read ? final : false,
    };
  }

  // No-op if nothing valid
  const entries = Object.entries(normalized);
  if (entries.length === 0) {
    return NextResponse.json({ ok: true });
  }

  // Upsert all four flags
  const ops = entries.map(([key, value]) => {
    const [roleId, formId] = key.split(':');
    return prisma.roleFormPermission.upsert({
      where: { roleId_formId: { roleId, formId } },
      update: {
        canRead: value.canRead,
        canSubmit: value.canSubmit,
        canConfirm: value.canConfirm,
        canFinalConfirm: value.canFinalConfirm,
      },
      create: {
        roleId,
        formId,
        canRead: value.canRead,
        canSubmit: value.canSubmit,
        canConfirm: value.canConfirm,
        canFinalConfirm: value.canFinalConfirm,
      },
    });
  });

  await prisma.$transaction(ops);
  return NextResponse.json({ ok: true });
}
