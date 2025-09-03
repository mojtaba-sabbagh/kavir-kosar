// app/(protected)/reports/[code]/page.tsx
import { notFound } from 'next/navigation';
import { canReadReport } from '@/lib/reports';

export default async function ReportByCode(props: { params: Promise<{ code: string }> }) {
  const { code } = await props.params;
  const canonical = code.toUpperCase();

  const ok = await canReadReport(canonical);
  if (!ok) return <div className="text-red-600">دسترسی غیرمجاز</div>;

  if (canonical === 'KARDEX') {
    const Comp = (await import('../kardex/report-client')).default;
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">گزارش کاردکس کالا</h1>
        <Comp />
      </div>
    );
  }

  notFound();
}
