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
  if (!user) {
    redirect('/auth/sign-in?next=/');
  }

  // 2) Fetch forms the user can submit
  const forms = await prisma.form.findMany({
    where: {
      isActive: true,
      rolePermissions: {
        some: {
          canSubmit: true,
          role: { users: { some: { userId: user.id } } },
        },
      },
    },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, code: true, titleFa: true },
  });

  // 3) Is admin? (for quick links)
  const isAdmin =
    (await prisma.userRole.count({
      where: { userId: user.id, role: { name: 'admin' } },
    })) > 0;

  return (
    <div className="space-y-10">
      {/* Greeting */}
      <div>
        <h2 className="text-2xl font-bold">
          خوش آمدید{user.name ? `، ${user.name}` : ''}
        </h2>
        <p className="text-gray-600 mt-2">
          فرم‌های مجاز برای شما در زیر نمایش داده شده‌اند.
        </p>

        {isAdmin && (
          <div className="mt-4">
            <Link
              href="/admin"
              className="inline-flex items-center rounded-md bg-blue-500 px-4 py-2 text-white no-underline hover:bg-blue-700"
            >
              مدیریت سامانه
            </Link>
          </div>
        )}
      </div>

      {/* Forms grid */}
      <div>
        <h3 className="text-lg font-semibold mb-4">فرم‌های شما</h3>
        {forms.length > 0 ? (
          <FormsGrid
            forms={forms.map((f) => ({
              id: f.id,
              titleFa: f.titleFa,
              code: f.code,
            }))}
            className="grid grid-cols-1 sm:grid-cols-4 lg:grid-cols-5 gap-4"
            itemClassName="rounded-2xl bg-blue-500 p-6 text-white text-center shadow hover:bg-blue-700 transition no-underline"
          />
        ) : (
          <div className="text-gray-500">
            برای شما فرمی تعریف نشده است.
            {isAdmin && (
              <>
                {' '}
                می‌توانید از بخش{' '}
                <Link href="/admin/forms" className="text-blue-600 no-underline hover:underline">
                  فرم‌ها
                </Link>{' '}
                و{' '}
                <Link
                  href="/admin/permissions"
                  className="text-blue-600 no-underline hover:underline"
                >
                  مجوزها
                </Link>{' '}
                فرم تعریف کنید و دسترسی بدهید.
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
