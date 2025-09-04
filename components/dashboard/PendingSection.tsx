import Link from 'next/link';
import { getMyPendingCounts } from '@/lib/confirm';

export const dynamic = 'force-dynamic';

export default async function PendingSection() {
  const counts = await getMyPendingCounts();
  if (counts.total === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">در انتظار تایید</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/confirmations" className="rounded-xl border p-4 bg-yellow-50 hover:bg-yellow-100 transition">
          <div className="text-sm text-gray-600">همه</div>
          <div className="text-2xl font-bold">{counts.total}</div>
        </Link>
        <Link href="/confirmations?kind=confirm" className="rounded-xl border p-4 bg-blue-50 hover:bg-blue-100 transition">
          <div className="text-sm text-gray-600">تایید</div>
          <div className="text-2xl font-bold">{counts.confirm}</div>
        </Link>
        <Link href="/confirmations?kind=final" className="rounded-xl border p-4 bg-green-50 hover:bg-green-100 transition">
          <div className="text-sm text-gray-600">تایید نهایی</div>
          <div className="text-2xl font-bold">{counts.final}</div>
        </Link>
      </div>
    </section>
  );
}
