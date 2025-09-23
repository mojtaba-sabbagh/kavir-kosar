// app/admin/layout.tsx
import Link from 'next/link';
import { requireAdminOrRedirect } from '@/lib/rbac';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminOrRedirect('/admin');

  return (
    <div className="min-h-[calc(100vh-160px)] container mx-auto max-w-none px-4 py-6">
      {/* items-start keeps both columns aligned at the top */}
      <div className="grid grid-cols-12 gap-6 items-start">
        {/* Sidebar */}
        <aside className="col-span-12 md:col-span-2 self-start md:sticky md:top-6">
          <nav className="space-y-2 rounded-2xl border bg-white p-4">
            <div className="text-sm text-gray-500 text-center mb-2">مدیریت سامانه</div>
            <Link href="/admin" className="block rounded-md px-3 py-2 hover:bg-gray-100 no-underline">داشبورد</Link>
            <Link href="/admin/kardex" className="block rounded-md px-3 py-2 hover:bg-gray-100 no-underline">کاردکس</Link>
            <Link href="/admin/fixed-info" className="block rounded-md px-3 py-2 hover:bg-gray-100 no-underline">اطلاعات ثابت</Link>
            <Link href="/admin/users" className="block rounded-md px-3 py-2 hover:bg-gray-100 no-underline">کاربران</Link>
            <Link href="/admin/roles" className="block rounded-md px-3 py-2 hover:bg-gray-100 no-underline">گروه‌ها</Link>
            <Link href="/admin/forms" className="block rounded-md px-3 py-2 hover:bg-gray-100 no-underline">فرم‌ها</Link>
            <Link href="/admin/permissions" className="block rounded-md px-3 py-2 hover:bg-gray-100 no-underline">مجوز فرم‌ها</Link>
            <Link href="/admin/reports" className="block rounded-md px-3 py-2 hover:bg-gray-100 no-underline">گزارش‌ها</Link>
            <Link href="/admin/report-permissions" className="block rounded-md px-3 py-2 hover:bg-gray-100 no-underline">مجوز گزارش‌ها</Link>
          </nav>
        </aside>

        {/* Right panel */}
        <main className="col-span-12 md:col-span-10">
          {/* This wrapper gives consistent vertical spacing, and
              removes any top margin on the first child */}
          <div className="space-y-6 [&>*:first-child]:mt-0">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
