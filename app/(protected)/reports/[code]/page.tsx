// app/(protected)/reports/[code]/page.tsx
import { redirect, notFound } from 'next/navigation';
import { canReadReport } from '@/lib/reports';
import { prisma } from '@/lib/db';

export default async function ReportByCode(props: { params: Promise<{ code: string }> }) {
  const { code: raw } = await props.params;
  const decoded = decodeURIComponent(raw || '');

  // Redirect bare form code to canonical report code if needed
  if (!/^RPT:/i.test(decoded)) {
    const rep = await prisma.report.findFirst({
      where: { code: { equals: `RPT:FORM:${decoded}`, mode: 'insensitive' } },
      select: { code: true },
    });
    if (rep?.code) redirect(`/reports/${encodeURIComponent(rep.code)}`);
  }

  const ok = await canReadReport(decoded);
  if (!ok) return <div className="text-red-600">دسترسی غیرمجاز</div>;

  // KARDEX special
  if (/^KARDEX$/i.test(decoded)) {
    const Comp = (await import('../kardex/report-client')).default;
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">گزارش کاردکس کالا</h1>
        <Comp />
      </div>
    );
  }

  // Generic
  const Generic = (await import('../generic/form-report-client')).default;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">گزارش فرم</h1>
      <Generic code={decoded} />
    </div>
  );
}
