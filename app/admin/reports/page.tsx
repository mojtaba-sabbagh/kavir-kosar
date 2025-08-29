import { prisma } from '@/lib/db';
import ReportsCreateForm from './reports-create-form';
import ReportRow from './report-row';

export default async function ReportsPage() {
  const reports = await prisma.report.findMany({
    orderBy: { sortOrder: 'asc' },
    select: { id: true, code: true, titleFa: true, url: true, sortOrder: true, isActive: true },
  });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-6">
        <h2 className="text-lg font-bold mb-4">ایجاد گزارش جدید</h2>
        <ReportsCreateForm />
      </div>

      <div className="rounded-2xl border bg-white p-6">
        <h2 className="text-lg font-bold mb-4">فهرست گزارش‌ها</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-right text-gray-500">
                <th className="py-2">کد</th>
                <th className="py-2">عنوان</th>
                <th className="py-2">مسیر/آدرس</th>
                <th className="py-2">ترتیب</th>
                <th className="py-2">فعال</th>
                <th className="py-2">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {reports.map(r => <ReportRow key={r.id} r={r} />)}
              {reports.length === 0 && (
                <tr><td className="py-4 text-gray-500" colSpan={6}>گزارشی ثبت نشده است.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
