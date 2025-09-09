// components/dashboard/ReportsSection.tsx
import Link from 'next/link';
import { listReadableReports } from '@/lib/reports';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ReportsSection() {
  const reports = await listReadableReports();
  if (!reports || reports.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">گزارش‌ها</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map((r) => {
          // If auto-created report, link by the underlying FORM code (friendlier URL).
          const isAuto = r.code.toUpperCase().startsWith('RPT:FORM:');
          const formCode = isAuto ? r.code.slice('RPT:FORM:'.length) : r.code;
          const href = `/reports/${encodeURIComponent(formCode)}`;

          return (
            <Link
              key={r.id}
              href={href}
              className="block rounded-xl bg-blue-50 hover:bg-blue-100 transition p-4 no-underline"
            >
              <div className="font-semibold">{r.titleFa}</div>
              <div className="text-xs text-gray-600 mt-1 font-mono ltr">{r.code}</div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
