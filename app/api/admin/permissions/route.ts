import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/rbac';
import { z } from 'zod';

const MatrixSchema = z.record(
  z.string(),
  z.object({
    canRead: z.boolean().optional().default(false),
    canSubmit: z.boolean().optional().default(false),
  })
);

/**
 * body.matrix: { "roleId:formId": { canRead, canSubmit }, ... }
 * Server normalization:
 *  - if canSubmit === true => canRead === true
 *  - if canRead === false  => canSubmit === false
 */
export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch (e: any) {
    const code = e?.message === 'UNAUTHORIZED' ? 401 : 403;
    return NextResponse.json({ message: 'دسترسی غیرمجاز' }, { status: code });
  }

  const body = await req.json().catch(() => null);
  const parsed = z.object({ matrix: MatrixSchema }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: 'ورودی نامعتبر' }, { status: 422 });
  }

  // Normalize
  const normalized: Record<string, { canRead: boolean; canSubmit: boolean }> = {};
  for (const [key, value] of Object.entries(parsed.data.matrix)) {
    const submit = !!value.canSubmit;
    const read = submit ? true : !!value.canRead;
    normalized[key] = { canRead: read, canSubmit: read ? submit : false };
  }

  // Upsert all
  const ops = Object.entries(normalized).map(([key, value]) => {
    const [roleId, formId] = key.split(':');
    return prisma.roleFormPermission.upsert({
      where: { roleId_formId: { roleId, formId } },
      update: { canRead: value.canRead, canSubmit: value.canSubmit },
      create: { roleId, formId, canRead: value.canRead, canSubmit: value.canSubmit },
    });
  });

  await prisma.$transaction(ops);
  return NextResponse.json({ ok: true });
}
