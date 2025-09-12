// app/(protected)/reports/[code]/page.tsx
import { prisma } from '@/lib/db';

export default async function ReportByCode(props: { params: Promise<{ code: string }> }) {
  const { code: raw } = await props.params;
  const decoded = decodeURIComponent(raw || '');
  const canonical = decoded;

  // Support “RPT:FORM:CODE” and plain “CODE”
  const formCode = canonical.startsWith('RPT:FORM:') ? canonical.slice('RPT:FORM:'.length) : canonical;
  // Fetch form title (safe fallback to decoded code if not found)
  const form = await prisma.form.findFirst({
    where: { code: formCode },
    select: { titleFa: true },
  });
  const headingTitle = form?.titleFa ?? formCode;

  const Generic = (await import('../generic/form-report-client')).default;

  return (
    <div className="space-y-4" dir="rtl">
      <h1 className="text-xl font-bold">گزارش {headingTitle}</h1>
      <Generic code={decoded} />
    </div>
  );
}
