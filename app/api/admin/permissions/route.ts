import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/rbac';
import { z } from 'zod';
import { syncReportPermsBulk } from '@/lib/report-sync';

const MatrixSchema = z.record(
  z.string(), // `${roleId}:${formId}`
  z.object({
    canRead: z.boolean().optional().default(false),
    canSubmit: z.boolean().optional().default(false),
    canConfirm: z.boolean().optional().default(false),
    canFinalConfirm: z.boolean().optional().default(false),
  })
);

type Cell = {
  canRead: boolean;
  canSubmit: boolean;
  canConfirm: boolean;
  canFinalConfirm: boolean;
};

export async function POST(req: Request) {
  try { await requireAdmin(); } 
  catch { return NextResponse.json({ message: 'دسترسی غیرمجاز' }, { status: 403 }); }

  const body = await req.json().catch(() => null);
  const parsed = z.object({ matrix: MatrixSchema }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: 'ورودی نامعتبر' }, { status: 422 });
  }

  // 1) Normalize client payload with company rules:
  //    - If canFinalConfirm => force canConfirm=false (XOR) and canRead=true
  //    - If canConfirm => canRead=true
  //    - If canRead=false => clear all others
  //    - If canSubmit=true => canRead=true
  const normalized: Record<string, Cell> = {};
  for (const [key, v] of Object.entries(parsed.data.matrix)) {
    const wantsFinal = !!v.canFinalConfirm;
    const wantsConfirm = !!v.canConfirm && !wantsFinal; // XOR: final wins, confirm forced false
    // compute read
    const read = wantsFinal || wantsConfirm || !!v.canSubmit || !!v.canRead;

    normalized[key] = {
      canRead: read,
      canSubmit: read ? !!v.canSubmit : false,
      canConfirm: read ? wantsConfirm : false,
      canFinalConfirm: read ? wantsFinal : false,
    };
  }

  // 2) Prepare changes for report mirroring
  const changes: Array<{ roleId: string; formId: string; canRead: boolean }> = [];

  // 3) Group by form to enforce "only one final confirmer per form"
  const perForm = new Map<string, Array<{ roleId: string; cell: Cell }>>();
  for (const [key, cell] of Object.entries(normalized)) {
    const [roleId, formId] = key.split(':');
    const arr = perForm.get(formId) ?? [];
    arr.push({ roleId, cell });
    perForm.set(formId, arr);
  }

  // 4) Write everything in a single transaction per form:
  for (const [formId, rows] of perForm) {
    await prisma.$transaction(async (tx) => {
      // Find all roles marked as final for this form in the submitted matrix
      const finals = rows.filter(r => r.cell.canFinalConfirm).map(r => r.roleId);

      // If there will be a final confirmer, we will clear all others on DB.
      // (If multiple finals are sent, we still allow them; after upserts we clear others to keep one-per-form.)
      for (const { roleId, cell } of rows) {
        changes.push({ roleId, formId, canRead: cell.canRead });

        await tx.roleFormPermission.upsert({
          where: { roleId_formId: { roleId, formId } },
          update: {
            canRead: cell.canRead,
            canSubmit: cell.canSubmit,
            canConfirm: cell.canConfirm,
            canFinalConfirm: cell.canFinalConfirm,
          },
          create: {
            roleId,
            formId,
            canRead: cell.canRead,
            canSubmit: cell.canSubmit,
            canConfirm: cell.canConfirm,
            canFinalConfirm: cell.canFinalConfirm,
          },
        });
      }

      // Enforce "only one final confirmer per form":
      if (finals.length > 0) {
        // Keep the last one in the submitted list as the winner
        const winnerRoleId = finals[finals.length - 1];
        await tx.roleFormPermission.updateMany({
          where: { formId, roleId: { not: winnerRoleId }, canFinalConfirm: true },
          data: { canFinalConfirm: false },
        });
      }
    });
  }

  // 5) Mirror Form.canRead → Report.canView
  await syncReportPermsBulk(changes);

  return NextResponse.json({ ok: true });
}
