import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const myPending = await prisma.confirmationTask.findMany({
    where: { userId: user.id, status: 'pending' },
    include: { entry: { select: { id: true, formId: true } } },
  });
  if (myPending.length === 0) return NextResponse.json({ counts: {} });

  const entryIds = myPending.map(t => t.formEntryId);
  const allForThese = await prisma.confirmationTask.findMany({
    where: { formEntryId: { in: entryIds } },
    select: { formEntryId: true, isFinal: true, status: true },
  });

  const entryOkForFinal: Record<string, boolean> = {};
  for (const eId of new Set(entryIds)) {
    entryOkForFinal[eId] = allForThese.some(g => g.formEntryId === eId && !g.isFinal && g.status === 'approved');
  }

  const countsByFormId: Record<string, number> = {};
  for (const t of myPending) {
    if (t.isFinal && !entryOkForFinal[t.formEntryId]) continue; // final not actionable yet
    countsByFormId[t.entry.formId] = (countsByFormId[t.entry.formId] ?? 0) + 1;
  }

  const forms = await prisma.form.findMany({
    where: { id: { in: Object.keys(countsByFormId) } },
    select: { id: true, code: true },
  });

  const byCode: Record<string, number> = {};
  for (const f of forms) byCode[f.code] = countsByFormId[f.id];

  return NextResponse.json({ counts: byCode });
}
