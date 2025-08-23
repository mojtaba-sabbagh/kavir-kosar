import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/rbac';
import { z } from 'zod';

const MatrixSchema = z.record(z.string(), z.object({
  canRead: z.boolean().optional().default(false),
  canSubmit: z.boolean().optional().default(false),
}));

/**
 * body.matrix: { "roleId:formId": { canRead: true, canSubmit: false }, ... }
 */
export async function POST(req: Request) {
  await requireAdmin();
  const body = await req.json();
  const parsed = z.object({ matrix: MatrixSchema }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ message: 'ورودی نامعتبر' }, { status: 422 });

  const ops: any[] = [];
  for (const [key, val] of Object.entries(parsed.data.matrix)) {
    const [roleId, formId] = key.split(':');
    ops.push(prisma.roleFormPermission.upsert({
      where: { roleId_formId: { roleId, formId } },
      update: { canRead: !!val.canRead, canSubmit: !!val.canSubmit },
      create: { roleId, formId, canRead: !!val.canRead, canSubmit: !!val.canSubmit },
    }));
  }
  await prisma.$transaction(ops);
  return NextResponse.json({ ok: true });
}
