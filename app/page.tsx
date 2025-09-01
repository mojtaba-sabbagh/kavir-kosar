// app/(protected)/page.tsx
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import FormsGrid from '@/components/FormsGrid';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function HomeProtected() {
  const user = await getSession();
  if (!user) redirect('/auth/sign-in?next=/');

  // فرم‌ها + مجوزها برای نقش‌های کاربر
  const rawForms = await prisma.form.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true, code: true, titleFa: true,
      rolePermissions: {
        where: { role: { users: { some: { userId: user.id } } } },
        select: { canRead: true, canSubmit: true },
      },
    },
  });

  // تجمیع مجوزها (OR)
  const forms = rawForms
    .map(f => {
      const canSubmit = f.rolePermissions.some(p => p.canSubmit);
      const canRead = canSubmit || f.rolePermissions.some(p => p.canRead);
      return { id: f.id, code: f.code, titleFa: f.titleFa, canRead, canSubmit };
    })
    // نمایش فقط اگر حداقل Read داشته باشد
    .filter(f => f.canRead || f.canSubmit);

  const isAdmin = (await prisma.userRole.count({
    where: { userId: user.id, role: { name: 'admin' } },
  })) > 0;

  // Compute pending counts per form code for the current user
const myPending = await prisma.confirmationTask.findMany({
  where: { userId: user.id, status: 'pending' },
  include: { entry: { select: { id: true, formId: true } } },
});

let counts: Record<string, number> = {};
if (myPending.length > 0) {
  const entryIds = myPending.map(t => t.formEntryId);

  const allForThese = await prisma.confirmationTask.findMany({
    where: { formEntryId: { in: entryIds } },
    select: { formEntryId: true, isFinal: true, status: true },
  });

  const entryOkForFinal: Record<string, boolean> = {};
  for (const eId of new Set(entryIds)) {
    entryOkForFinal[eId] = allForThese.some(
      g => g.formEntryId === eId && !g.isFinal && g.status === 'approved'
    );
  }

  const countsByFormId: Record<string, number> = {};
  for (const t of myPending) {
    if (t.isFinal && !entryOkForFinal[t.formEntryId]) continue; // final not actionable yet
    countsByFormId[t.entry.formId] = (countsByFormId[t.entry.formId] ?? 0) + 1;
  }

  const formsMap = Object.fromEntries(
    (await prisma.form.findMany({
      where: { id: { in: Object.keys(countsByFormId) } },
      select: { id: true, code: true },
    })).map(f => [f.id, f.code] as const)
  );

  counts = Object.fromEntries(
    Object.entries(countsByFormId).map(([formId, n]) => [formsMap[formId], n])
  );
}

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-2xl font-bold">خوش آمدید{user.name ? `، ${user.name}` : ''}</h2>
        <p className="text-gray-600 mt-2">فرم‌های مجاز برای شما در زیر نمایش داده شده‌اند.</p>
        {isAdmin && (
          <div className="mt-4">
            <Link href="/admin" className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-white no-underline hover:bg-blue-700">
              مدیریت سامانه
            </Link>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">فرم‌های شما</h3>
        {forms.length > 0 ? (
          <FormsGrid forms={forms} pendingCountsByCode={counts} />
        ) : (
          <div className="text-gray-500">
            برای شما فرمی تعریف نشده است.
            {isAdmin && (
              <>
                {' '}از بخش{' '}
                <Link href="/admin/forms" className="text-blue-600 no-underline hover:underline">فرم‌ها</Link>{' '}
                و{' '}
                <Link href="/admin/permissions" className="text-blue-600 no-underline hover:underline">مجوزها</Link>{' '}
                می‌توانید فرم تعریف کنید و دسترسی بدهید.
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
