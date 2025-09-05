// app/(protected)/page.tsx
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import FormsGrid from '@/components/FormsGrid';
import ReportsSection from '@/components/dashboard/ReportsSection';
import PendingSection from '@/components/dashboard/PendingSection';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function HomeProtected() {
  // 1) Require login
  const user = await getSession();
  if (!user) redirect('/auth/sign-in?next=/');
  // 2) Forms + effective permissions (OR across user's roles)
  const rawForms = await prisma.form.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      code: true,
      titleFa: true,
      rolePermissions: {
        where: { role: { users: { some: { userId: user.id } } } },
        select: { canSubmit: true },
      },
    },
  });

  const forms = rawForms
    .map(f => {
      const canSubmit = f.rolePermissions.some(p => p.canSubmit);
      return { id: f.id, code: f.code, titleFa: f.titleFa, canSubmit };
    })
    .filter(f => f.canSubmit); // only show if at least submit


  // 4) Is admin? (quick link)
  const isAdmin =
    (await prisma.userRole.count({
      where: { userId: user.id, role: { name: 'admin' } },
    })) > 0;

  return (
    <div className="space-y-10">
      {/* Greeting (no borders/boxes) */}
      <div>

        {isAdmin && (
          <div className="mt-4">
            <Link
              href="/admin"
              className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-white no-underline hover:bg-blue-700"
            >
              مدیریت سامانه
            </Link>
            <Link href="/admin/kardex" className="rounded-md border px-3 py-2 hover:bg-gray-50">
                  کاردکس (مدیریت)
            </Link>
          </div>
        )}
      </div>
      <PendingSection />
      {/* Forms (blue for Send, gray for Read-only) */}
      <div>
        <h3 className="text-lg font-semibold mb-4">فرم‌های شما</h3>
        {forms.length > 0 ? (
          <FormsGrid forms={forms} />
        ) : (
          <div className="text-gray-500">
            برای شما فرمی در دسترس نیست.
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

      {/* Reports */}
      <ReportsSection />
    </div>
  );
}
