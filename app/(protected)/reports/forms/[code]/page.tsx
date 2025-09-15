import ReportClient from './report-client';

export const dynamic = 'force-dynamic';

export default async function FormReportPage(ctx: { params: Promise<{ code: string }> }) {
  // server side just renders a client shell; data fetched client-side via API
  const params = await ctx.params;
  return <ReportClient code={params.code} />;
}
