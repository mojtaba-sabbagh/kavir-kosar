import ReportClient from './report-client';

export const dynamic = 'force-dynamic';

export default async function FormReportPage({ params }: { params: { code: string } }) {
  // server side just renders a client shell; data fetched client-side via API
  return <ReportClient code={params.code} />;
}
