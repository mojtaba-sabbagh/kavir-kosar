import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/db';

export default async function ReportByCode(ctx: { params: Promise<{ code: string }> }) {
  const params = await ctx.params;
  const decoded = decodeURIComponent(params.code);
  const rpt = await prisma.report.findFirst({
    where: { code: decoded },
    select: { id: true, code: true, titleFa: true, url: true },
  });

  if (!rpt) return notFound();

  // If this report has a custom page, go there (e.g., /reports/kardex)
  if (rpt.url) redirect(rpt.url);

  // Otherwise fall back to the generic form report page
  const Generic = (await import('../generic/form-report-client')).default;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">گزارش فرم: {decoded}</h1>
      <Generic code={decoded} />
    </div>
  );
}
