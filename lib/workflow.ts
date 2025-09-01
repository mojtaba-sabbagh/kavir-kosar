import { prisma } from '@/lib/db';

export async function generateConfirmationTasks(entryId: string) {
  const entry = await prisma.formEntry.findUnique({
    where: { id: entryId },
    select: { formId: true },
  });
  if (!entry) throw new Error('ENTRY_NOT_FOUND');

  const [confirmers, finalConf] = await Promise.all([
    prisma.formConfirmer.findMany({ where: { formId: entry.formId } }),
    prisma.formFinalConfirmer.findUnique({ where: { formId: entry.formId } }),
  ]);

  const data: { formEntryId: string; userId: string; isFinal: boolean }[] = [];
  for (const c of confirmers) data.push({ formEntryId: entryId, userId: c.userId, isFinal: false });
  if (finalConf) data.push({ formEntryId: entryId, userId: finalConf.userId, isFinal: true });
  if (data.length === 0) return;

  await prisma.confirmationTask.createMany({ data, skipDuplicates: true });
}
