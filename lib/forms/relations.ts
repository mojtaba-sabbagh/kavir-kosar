import { prisma } from '@/lib/db';
import type { FormField } from '@prisma/client';

export async function syncEntryRelations(opts: {
  entryId: string;
  fields: Pick<FormField, 'key'|'type'|'config'>[];
  payload: Record<string, any>;
}) {
  const { entryId, fields, payload } = opts;

  // Collect target ids & relation labels from payload
  const wanted: { targetEntryId: string; relation: string }[] = [];

  for (const f of fields) {
    const cfg = (f.config ?? {}) as any;
    const relation = String(cfg?.relation ?? 'relatesTo');

    if (f.type === 'entryRef') {
      const id = payload[f.key];
      if (typeof id === 'string') wanted.push({ targetEntryId: id, relation });
    } else if (f.type === 'entryRefMulti') {
      const arr = payload[f.key] as string[] | undefined;
      if (Array.isArray(arr)) {
        for (const id of arr) if (typeof id === 'string')
          wanted.push({ targetEntryId: id, relation });
      }
    }
  }

  // Load existing links for this source
  const existing = await prisma.entryRelation.findMany({
    where: { sourceEntryId: entryId },
    select: { id: true, targetEntryId: true, relation: true },
  });

  // Compute diffs
  const toKey = (t: { targetEntryId: string; relation: string }) => `${t.targetEntryId}::${t.relation}`;
  const wantedSet = new Set(wanted.map(toKey));
  const existingSet = new Set(existing.map(toKey));

  const toCreate = wanted.filter(w => !existingSet.has(toKey(w)));
  const toDelete = existing.filter(e => !wantedSet.has(`${e.targetEntryId}::${e.relation}`));

  // Apply
  if (toDelete.length) {
    await prisma.entryRelation.deleteMany({
      where: {
        id: { in: toDelete.map(d => d.id) },
      },
    });
  }
  if (toCreate.length) {
    await prisma.entryRelation.createMany({
      data: toCreate.map(t => ({
        sourceEntryId: entryId,
        targetEntryId: t.targetEntryId,
        relation: t.relation,
      })),
      skipDuplicates: true,
    });
  }
}
