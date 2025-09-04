// lib/confirm.ts
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function getMyPendingCounts() {
  const me = await getSession();
  if (!me) return { confirm: 0, final: 0, total: 0 };

  const [confirm, final] = await Promise.all([
    prisma.confirmationTask.count({
      where: { userId: me.id, isFinal: false, signedAt: null }, // pending regular confirms
    }),
    prisma.confirmationTask.count({
      where: { userId: me.id, isFinal: true, signedAt: null },  // pending final confirms
    }),
  ]);
  return { confirm, final, total: confirm + final };
}

export async function getMyPendingList(limit = 50) {
  const me = await getSession();
  if (!me) return [];

  const rows = await prisma.confirmationTask.findMany({
    where: { userId: me.id, signedAt: null },
    orderBy: [{ isFinal: 'desc' }, { id: 'asc' }], // no createdAt on this model
    take: limit,
    select: {
      id: true,
      isFinal: true,
      formEntryId: true,
      entry: {
        select: {
          id: true,
          createdAt: true,
          formId: true,
          // ⬇️ Pull code/title from related Form
          form: { select: { code: true, titleFa: true } },
        },
      },
    },
  });

  return rows.map(r => ({
    taskId: r.id,
    kind: r.isFinal ? ('final' as const) : ('confirm' as const),
    entryId: r.formEntryId,
    formCode: r.entry?.form?.code ?? '',         // ← from relation
    formTitleFa: r.entry?.form?.titleFa ?? '',   // ← from relation
    createdAt: r.entry?.createdAt ?? null,
  }));
}
