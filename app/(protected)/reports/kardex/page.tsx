import KardexLive from '@/components/reports/KardexLive';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function KardexReportPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">گزارش کاردکس کالا</h1>
      </div>

      <KardexLive />
    </div>
  );
}
