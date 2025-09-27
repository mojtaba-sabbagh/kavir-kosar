'use client';
import Link from 'next/link';

export default function ConfirmationsClient({ items }:{
  items: { taskId:string; kind:'confirm'|'final'; entryId:string; formCode:string; formTitleFa:string; createdAt:string | null }[];
}) {
  return (
    <div className="rounded-xl border bg-white overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50">
            <th className="p-2 text-right">فرم</th>
            <th className="p-2 text-right">کد</th>
            <th className="p-2 text-right">ایجاد</th>
            <th className="p-2 text-right">عملیات</th>
          </tr>
        </thead>
        <tbody>
          {items.map(it => (
            <tr key={it.taskId} className="border-t">
              <td className="p-2">{it.formTitleFa}</td>
              <td className="p-2 font-mono ltr">{it.formCode}</td>
              <td className="p-2">
                {it.createdAt ? new Date(it.createdAt).toLocaleString('fa-IR') : '—'}
              </td>
              <td className="p-2">
                <div className="flex items-center gap-3">
                  <Link
                    href={`/entries/${it.entryId}`}
                    className="rounded-md border px-3 py-1 hover:bg-gray-50"
                  >
                    مشاهده
                  </Link>
                </div>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={4} className="p-6 text-center text-gray-500">
                موردی یافت نشد
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
