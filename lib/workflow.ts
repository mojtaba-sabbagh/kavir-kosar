import { prisma } from '@/lib/db';

/**
 * Create ConfirmationTask rows for all users who should confirm this entry's form.
 * Role-based: users who have canConfirm / canFinalConfirm on the form.
 * Idempotent thanks to the unique index and skipDuplicates.
 */
export async function generateConfirmationTasks(entryId: string) {
  return prisma.$transaction(async (tx) => {
    // Load entry + formId
    const entry = await tx.formEntry.findUnique({
      where: { id: entryId },
      select: { id: true, formId: true, createdBy: true },
    });
    if (!entry) throw new Error('ENTRY_NOT_FOUND');

    // 1) Find all roles that can confirm this form
    const confirmRoles = await tx.roleFormPermission.findMany({
      where: { formId: entry.formId, canConfirm: true },
      select: { roleId: true },
    });
    const finalRoles = await tx.roleFormPermission.findMany({
      where: { formId: entry.formId, canFinalConfirm: true },
      select: { roleId: true },
    });

    const confirmRoleIds = confirmRoles.map(r => r.roleId);
    const finalRoleIds   = finalRoles.map(r => r.roleId);

    // 2) Resolve users for those roles
    const confirmUsers = confirmRoleIds.length
      ? await tx.userRole.findMany({
          where: { roleId: { in: confirmRoleIds } },
          select: { userId: true },
        })
      : [];

    const finalUsers = finalRoleIds.length
      ? await tx.userRole.findMany({
          where: { roleId: { in: finalRoleIds } },
          select: { userId: true },
        })
      : [];

    // 3) Build unique task list
    const tasks: { formEntryId: string; userId: string; isFinal: boolean }[] = [];
    const seen = new Set<string>();

    for (const u of confirmUsers) {
      const key = `${entry.id}:${u.userId}:0`;
      if (!seen.has(key)) {
        seen.add(key);
        tasks.push({ formEntryId: entry.id, userId: u.userId, isFinal: false });
      }
    }
    for (const u of finalUsers) {
      const key = `${entry.id}:${u.userId}:1`;
      if (!seen.has(key)) {
        seen.add(key);
        tasks.push({ formEntryId: entry.id, userId: u.userId, isFinal: true });
      }
    }

    // Optional: if you don't want the submitter to confirm their own entry:
    // tasks = tasks.filter(t => t.userId !== entry.createdBy);

    if (tasks.length === 0) return { created: 0 };

    // 4) Insert tasks idempotently
    const res = await tx.confirmationTask.createMany({
      data: tasks,
      skipDuplicates: true,
    });

    return { created: res.count };
  });
}
