import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function listSubmittableFormsForMe() {
  const user = await getSession();
  if (!user) return [];

  const rows = await prisma.roleFormPermission.findMany({
    where: {
      canSubmit: true,
      role: { users: { some: { userId: user.id } } },
      form: { isActive: true },
    },
    select: {
      form: { select: { id: true, code: true, titleFa: true, sortOrder: true } },
    },
    orderBy: [
      { form: { sortOrder: 'asc' } },
      { form: { titleFa: 'asc' } },
    ],
  });

  // dedupe in case multiple roles grant submit on the same form
  const seen = new Set<string>();
  const forms = [];
  for (const r of rows) {
    const f = r.form!;
    if (!seen.has(f.id)) { seen.add(f.id); forms.push(f); }
  }
  return forms;
}
