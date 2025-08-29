// app/(protected)/page.tsx
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import FormsGrid from '@/components/FormsGrid';

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
        select: { canRead: true, canSubmit: true },
      },
    },
  });

  const forms = rawForms
    .map(f => {
      const canSubmit = f.rolePermissions.some(p => p.canSubmit);
      const canRead = canSubmit || f.rolePermissions.some(p => p.canRead);
      return { id: f.id, code: f.code, titleFa: f.titleFa, canRead, canSubmit };
    })
    .filter(f => f.canRead || f.canSubmit); // only show if at least read

  // 3) Reports the user can view
  const reports = await prisma.report.findMany({
    where: {
      isActive: true,
      rolePermissions: {
        some: {
          canView: true,
          role: { users: { some: { userId: user.id } } },
        },
      },
    },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, code: true, titleFa: true, url: true },
  });

  // 4) Is admin? (quick link)
  const isAdmin =
    (await prisma.userRole.count({
      where: { userId: user.id, role: { name: 'admin' } },
    })) > 0;

  return (
    <div className="space-y-10">
      {/* Greeting (no borders/boxes) */}
      <div>
        <h2 className="text-2xl font-bold">خوش آمدید{user.name ? `، ${user.name}` : ''}</h2>
        <p className="text-gray-600 mt-2">فرم‌ها و گزارش‌های مجاز برای شما در زیر نمایش داده شده‌اند.</p>

        {isAdmin && (
          <div className="mt-4">
            <Link
              href="/admin"
              className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-white no-underline hover:bg-blue-700"
            >
              مدیریت سامانه
            </Link>
          </div>
        )}
      </div>

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
      <div>
        <h3 className="text-lg font-semibold mb-4">گزارش‌ها</h3>
        {reports.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {reports.map(r => (
              <Link
                key={r.id}
                href={r.url ?? `/reports/${encodeURIComponent(r.code)}`}
                className="no-underline rounded-2xl bg-blue-600 p-6 text-white shadow hover:bg-blue-700 transition"
              >
                <div className="text-base font-semibold mb-1">{r.titleFa}</div>
                <div className="text-white/80 text-xs">کد گزارش: {r.code}</div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-gray-500">گزارشی برای شما در دسترس نیست.</div>
        )}
      </div>
    </div>
  );
}
