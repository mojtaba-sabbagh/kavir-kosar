import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { applyKardexForEntry } from '@/lib/kardex/apply';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: { entryId: string } }
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ message: 'ابتدا وارد سامانه شوید' }, { status: 401 });

  const entryId = params.entryId;

  // My pending task
  const myTask = await prisma.confirmationTask.findFirst({
    where: { formEntryId: entryId, userId: user.id, status: 'pending' },
  });
  if (!myTask) return NextResponse.json({ message: 'وظیفه‌ای برای تأیید شما یافت نشد' }, { status: 404 });

  // Defense in depth: check role permissions
  const can = await prisma.roleFormPermission.count({
    where: {
      formId: (await prisma.formEntry.findUnique({ where: { id: entryId }, select: { formId: true } }))!.formId,
      OR: [
        { canFinalConfirm: true, role: { users: { some: { userId: user.id } } } },
        { canConfirm: true, role: { users: { some: { userId: user.id } } } },
      ],
    },
  });
  if (!can) return NextResponse.json({ message: 'مجوز تأیید ندارید' }, { status: 403 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const tasks = await tx.confirmationTask.findMany({ where: { formEntryId: entryId } });
      const anyRegularApproved = tasks.some(t => !t.isFinal && t.status === 'approved');

      if (!myTask.isFinal) {
        if (anyRegularApproved) {
          // another regular already approved
          return NextResponse.json({ message: 'این فرم توسط تأییدکننده دیگری ثبت شده است' }, { status: 409 });
        }
        await tx.confirmationTask.update({
          where: { id: myTask.id },
          data: { status: 'approved', signedAt: new Date() },
        });
        await tx.confirmationTask.updateMany({
          where: { formEntryId: entryId, isFinal: false, id: { not: myTask.id } },
          data: { status: 'superseded' },
        });
        await tx.formEntry.update({
          where: { id: entryId },
          data: { firstConfirmedAt: new Date(), status: 'confirmed' },
        });
        return NextResponse.json({ ok: true, type: 'regular' });
      } else {
        if (!anyRegularApproved) {
          return NextResponse.json({ message: 'ابتدا باید یک تأییدکننده، فرم را تأیید کند' }, { status: 409 });
        }
        await tx.confirmationTask.update({
          where: { id: myTask.id },
          data: { status: 'approved', signedAt: new Date() },
        });
        await tx.formEntry.update({
          where: { id: entryId },
          data: { finalConfirmedAt: new Date(), status: 'finalConfirmed' },
        });
        
        const result = await applyKardexForEntry(entryId, user.id);
        await prisma.confirmationTask.updateMany({
            where: { userId: user.id, formEntryId: entryId, isDone: false },
            data: { isDone: true },
        });
        
        return NextResponse.json({ ok: true, type: 'final' });
      }
    });

    // if transaction returned a Response (409), pass it through
    if ('body' in (result as any)) return result as any;
    return result as any;
  } catch (e) {
    console.error('confirm error:', e);
    return NextResponse.json({ message: 'خطای سرور' }, { status: 500 });
  }
}
