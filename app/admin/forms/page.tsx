import { prisma } from '@/lib/db';
import FormsCreateForm from './forms-create-form';
import FormEditDialog from './form-edit-dialog';
import DeleteFormForm from './delete-form-form';

export default async function FormsPage() {
  const forms = await prisma.form.findMany({ orderBy: { sortOrder: 'asc' } });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-6">
        <h2 className="text-lg font-bold mb-4">ایجاد فرم جدید</h2>
        <FormsCreateForm />
      </div>

      <div className="rounded-2xl border bg-white p-6">
        <h2 className="text-lg font-bold mb-4">فهرست فرم‌ها</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-right text-gray-500">
                <th className="py-2">کد</th>
                <th className="py-2">عنوان</th>
                <th className="py-2">ترتیب</th>
                <th className="py-2">فعال</th>
                <th className="py-2">ویرایش</th>
                <th className="py-2">حذف</th>
              </tr>
            </thead>
            <tbody>
              {forms.map((f) => (
                <tr key={f.id} className="border-t">
                  <td className="py-2">{f.code}</td>
                  <td className="py-2">{f.titleFa}</td>
                  <td className="py-2">{f.sortOrder}</td>
                  <td className="py-2">{f.isActive ? 'بله' : 'خیر'}</td>
                  <td className="py-2">
                    <FormEditDialog form={f as any} />
                  </td>
                  <td className="py-2">
                    <DeleteFormForm formId={f.id} />
                  </td>
                </tr>
              ))}
              {forms.length === 0 && (
                <tr><td className="py-4 text-gray-500" colSpan={6}>فرمی ثبت نشده است.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
