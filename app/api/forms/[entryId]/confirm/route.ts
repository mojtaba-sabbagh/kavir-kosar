import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { applyKardexForEntry, formWantsApplyOnAnyConfirm } from '@/lib/kardex/apply';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: Request, ctx: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await ctx.params;
  const user = await getSession();
  if (!user) return NextResponse.json({ message: 'ابتدا وارد سامانه شوید' }, { status: 401 });

  const myTask = await prisma.confirmationTask.findFirst({
    where: { formEntryId: entryId, userId: user.id, signedAt: null },
    select: { id: true, isFinal: true },
  });
  if (!myTask) return NextResponse.json({ message: 'دسترسی غیرمجاز یا موردی برای تایید یافت نشد' }, { status: 403 });

  // Entry + fields
  const entry = await prisma.formEntry.findUnique({
    where: { id: entryId },
    select: {
      id: true, status: true,
      form: { select: { id: true, code: true, fields: true } },
    },
  });
  if (!entry || !entry.form) return NextResponse.json({ message: 'فرم یافت نشد' }, { status: 404 });

  // Mark *my* task as signed
  await prisma.confirmationTask.update({ where: { id: myTask.id }, data: { signedAt: new Date() } });

  // Apply Kardex depending on mapping config + type of confirm
  let applied = false;
  if (myTask.isFinal) {
    await prisma.formEntry.update({ where: { id: entryId }, data: { status: 'finalConfirmed', finalConfirmedAt: new Date() } });
    const res = await applyKardexForEntry(entryId, user.id);
    applied = !!res.applied;
    return NextResponse.json({ ok: true, step: 'final', applied });
  } else {
    // regular confirm
    await prisma.formEntry.update({ where: { id: entryId }, data: { status: 'confirmed' } });
    const wantsAnyConfirm = formWantsApplyOnAnyConfirm(entry.form.fields as any[]);
    if (wantsAnyConfirm) {
      const res = await applyKardexForEntry(entryId, user.id);
      applied = !!res.applied;
    }
    return NextResponse.json({ ok: true, step: 'confirm', applied });
  }
}
