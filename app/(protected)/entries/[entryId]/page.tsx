import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function EntryDetailsPage(props: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await props.params; // ⬅️ await params

  const entry = await prisma.formEntry.findUnique({
    where: { id: entryId },
    select: {
      id: true,
      createdAt: true,
      status: true,
      payload: true,
      form: { select: { code: true, titleFa: true } },
    },
  });

  if (!entry) notFound();

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">فرم: {entry.form.titleFa}</h1>
        <Link href="/confirmations" className="text-sm hover:underline">بازگشت</Link>
      </div>

      <div className="rounded-xl border bg-white p-4 space-y-3">
        <div className="text-sm text-gray-600">
          <span className="ml-2">کد فرم:</span><span className="font-mono ltr">{entry.form.code}</span>
        </div>
        <div className="text-sm text-gray-600">
          <span className="ml-2">وضعیت:</span>{entry.status}
        </div>
        <div className="text-sm text-gray-600">
          <span className="ml-2">ایجاد:</span>{entry.createdAt.toLocaleString('fa-IR')}
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold mb-3">مقادیر</h2>
        <PayloadView payload={entry.payload as any} />
      </div>
    </div>
  );
}

// Simple read-only payload viewer
function PayloadView({ payload }: { payload: Record<string, any> }) {
  const keys = Object.keys(payload ?? {});
  if (keys.length === 0) return <div className="text-gray-500">—</div>;
  return (
    <table className="w-full text-sm">
      <tbody>
        {keys.map(k => (
          <tr key={k} className="border-t">
            <td className="p-2 text-gray-600">{k}</td>
            <td className="p-2">{render(payload[k])}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function render(v: any) {
  if (v == null) return '—';
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
