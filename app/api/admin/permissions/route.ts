import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/rbac';
import { z } from 'zod';

const Cell = z.object({
  canRead: z.boolean().optional().default(false),
  canSubmit: z.boolean().optional().default(false),
  canConfirm: z.boolean().optional().default(false),
  canFinalConfirm: z.boolean().optional().default(false),
});
const MatrixSchema = z.record(z.string(), Cell); // key = "roleId:formId"

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try { await requireAdmin(); } catch { return NextResponse.json({ message: 'دسترسی غیرمجاز' }, { status: 403 }); }

  const body = await req.json().catch(() => null);
  const parsed = z.object({ matrix: MatrixSchema }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ message: 'ورودی نامعتبر' }, { status: 422 });

  // 1) Normalize incoming cells per rule
  const proposed: Record<string, { canRead:boolean; canSubmit:boolean; canConfirm:boolean; canFinalConfirm:boolean }> = {};
  for (const [k, v] of Object.entries(parsed.data.matrix)) {
    // read must be true if any capability is true
    let canFinalConfirm = !!v.canFinalConfirm;
    let canConfirm      = !!v.canConfirm;
    let canSubmit       = !!v.canSubmit;
    let canRead         = !!v.canRead || canSubmit || canConfirm || canFinalConfirm;

    // company rules:
    // - final and confirm are mutually exclusive
    if (canFinalConfirm && canConfirm) {
      // prefer final, drop confirm
      canConfirm = false;
    }
    // - if read is off, everything else must be off
    if (!canRead) {
      canSubmit = false; canConfirm = false; canFinalConfirm = false;
    }
    // ensure read if any others true
    if (canSubmit || canConfirm || canFinalConfirm) canRead = true;

    proposed[k] = { canRead, canSubmit, canConfirm, canFinalConfirm };
  }

  // 2) Load current DB perms for all affected forms so we can validate "one final per form"
  const affected = Object.keys(proposed).map(k => {
    const [roleId, formId] = k.split(':');
    return { roleId, formId };
  });
  const affectedFormIds = Array.from(new Set(affected.map(a => a.formId)));

  const current = await prisma.roleFormPermission.findMany({
    where: { formId: { in: affectedFormIds } },
    select: { roleId: true, formId: true, canRead: true, canSubmit: true, canConfirm: true, canFinalConfirm: true },
  });

  // Build a map of the post-save state = current DB state overridden by proposed
  const nextMap = new Map<string, { roleId:string; formId:string; canRead:boolean; canSubmit:boolean; canConfirm:boolean; canFinalConfirm:boolean }>();
  // seed with current
  for (const c of current) {
    const key = `${c.roleId}:${c.formId}`;
    nextMap.set(key, { ...c });
  }
  // apply proposed changes
  for (const [k, v] of Object.entries(proposed)) {
    const [roleId, formId] = k.split(':');
    nextMap.set(k, { roleId, formId, ...v });
  }

  // 3) Validate: for each form, at most one final = true
  for (const formId of affectedFormIds) {
    let finals = 0;
    for (const v of nextMap.values()) {
      if (v.formId === formId && v.canFinalConfirm) finals++;
      if (finals > 1) {
        return NextResponse.json(
          { message: 'برای هر فرم فقط یک "تاییدکننده نهایی" مجاز است' },
          { status: 422 }
        );
      }
    }
  }

  // 4) Persist in a transaction
  await prisma.$transaction(
    Array.from(nextMap.entries()).map(([k, v]) => {
      const [roleId, formId] = k.split(':');
      return prisma.roleFormPermission.upsert({
        where: { roleId_formId: { roleId, formId } },
        update: {
          canRead: v.canRead,
          canSubmit: v.canSubmit,
          canConfirm: v.canConfirm,
          canFinalConfirm: v.canFinalConfirm,
        },
        create: {
          roleId, formId,
          canRead: v.canRead,
          canSubmit: v.canSubmit,
          canConfirm: v.canConfirm,
          canFinalConfirm: v.canFinalConfirm,
        },
      });
    })
  );

  return NextResponse.json({ ok: true });
}
