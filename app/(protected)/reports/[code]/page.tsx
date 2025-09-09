import { notFound } from 'next/navigation';
import { requireReportView } from '@/lib/reports-guard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ReportByCode(props: { params: Promise<{ code: string }> }) {
  const { code: raw } = await props.params;

  // decode + canonicalize
  const decoded = decodeURIComponent(raw || '');
  const canonical = decoded.toUpperCase();

  // If it's an auto-report like RPT:FORM:STP-INPUT, extract the form code
  const isAuto = canonical.startsWith('RPT:FORM:');
  const formCode = isAuto ? canonical.slice('RPT:FORM:'.length) : canonical;

  // Guard (accepts form code or auto-report code)
  try {
    await requireReportView(canonical); // checks RoleReportPermission.canView
  } catch (e: any) {
    if (e?.message === 'NOT_FOUND') notFound();
    return <div className="text-red-600">دسترسی غیرمجاز</div>;
  }

  // Built-in Kardex report
  if (formCode === 'KARDEX') {
    const Comp = (await import('../kardex/report-client')).default;
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">گزارش کاردکس کالا</h1>
        <Comp />
      </div>
    );
  }

  // Generic per-form report renderer (you can customize later)
  const GenericReport = (await import('../generic/form-report-client')).default;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">گزارش فرم {formCode}</h1>
      <GenericReport code={formCode} />
    </div>
  );
}
