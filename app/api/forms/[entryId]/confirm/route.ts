import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { applyKardexForEntry } from '@/lib/kardex/apply';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: Request, ctx: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await ctx.params; // ⬅️ await params
  const user = await getSession();
  if (!user) return NextResponse.json({ message: 'ابتدا وارد سامانه شوید' }, { status: 401 });

  // Find my pending task for this entry
  const myTask = await prisma.confirmationTask.findFirst({
    where: { formEntryId: entryId, userId: user.id, signedAt: null },
    select: { id: true, isFinal: true },
  });
  if (!myTask) return NextResponse.json({ message: 'دسترسی غیرمجاز یا موردی برای تایید یافت نشد' }, { status: 403 });

  // Basic entry check
  const entry = await prisma.formEntry.findUnique({
    where: { id: entryId },
    select: { id: true, status: true },
  });
  if (!entry) return NextResponse.json({ message: 'فرم یافت نشد' }, { status: 404 });

  // 1) Mark MY task signed
  await prisma.confirmationTask.update({
    where: { id: myTask.id },
    data: { signedAt: new Date() },
  });

  // 2) If this is a regular confirm, you might set intermediate status
  if (!myTask.isFinal) {
    await prisma.formEntry.update({
      where: { id: entryId },
      data: { status: 'confirmed' }, // optional: or keep your existing workflow
    });
    return NextResponse.json({ ok: true, step: 'confirm' });
  }

  // 3) Final confirm: mark entry final + apply Kardex
  await prisma.formEntry.update({
    where: { id: entryId },
    data: {
      status: 'finalConfirmed',
      finalConfirmedAt: new Date(),
      finalConfirmedById: user.id, // ✅ now valid
    },
  });


  const result = await applyKardexForEntry(entryId, user.id); // idempotent
  return NextResponse.json({ ok: true, step: 'final', result });
}
