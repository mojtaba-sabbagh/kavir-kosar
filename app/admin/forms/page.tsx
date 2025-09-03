import { prisma } from '@/lib/db';
import { requireAdminOrRedirect } from '@/lib/rbac';
import Link from 'next/link';
import DeleteFormButton from '@/components/admin/DeleteFormButton';

export default async function AdminFormsList() {
  await requireAdminOrRedirect();

  const forms = await prisma.form.findMany({
    orderBy: { sortOrder: 'asc' },
    select: { id: true, code: true, titleFa: true, isActive: true, version: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">فرم‌ها</h1>
        <Link href="/admin/forms/new" className="rounded-md bg-blue-600 text-white px-4 py-2 hover:bg-blue-700">فرم جدید</Link>
      </div>
      <div className="rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="p-3 text-right">کد</th>
              <th className="p-3 text-right">عنوان</th>
              <th className="p-3 text-right">نسخه</th>
              <th className="p-3 text-right">وضعیت</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {forms.map(f => (
              <tr key={f.id} className="border-t">
                <td className="p-3 font-mono">{f.code}</td>
                <td className="p-3">{f.titleFa}</td>
                <td className="p-3">{f.version}</td>
                <td className="p-3">{f.isActive ? 'فعال' : 'غیرفعال'}</td>
                <td className="p-3 text-left flex gap-2 justify-end">
                  <Link href={`/admin/forms/${f.id}/builder`} className="rounded-md border px-3 py-1 hover:bg-gray-50">ویرایش</Link>
                  <DeleteFormButton id={f.id} />
                </td>
              </tr>
            ))}
            {forms.length === 0 && (
              <tr><td className="p-6 text-center text-gray-500" colSpan={5}>فرمی وجود ندارد</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
