'use client';
import { useEffect, useState } from 'react';

export default function KardexReportClient() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  async function load(query = '') {
    setLoading(true);
    const res = await fetch(`/api/reports/kardex?q=${encodeURIComponent(query)}`, { cache: 'no-store' });
    const j = await res.json();
    setRows(j.items ?? []);
    setTotal(j.total ?? 0);
    setLoading(false);
  }

  useEffect(() => { load(''); }, []);

  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="flex gap-2 mb-3">
        <input
          className="flex-1 border rounded-md px-3 py-2"
          placeholder="جستجو بر اساس نام کالا…"
          value={q}
          onChange={e=>setQ(e.target.value)}
        />
      <button className="border rounded-md px-3 py-2 hover:bg-gray-50" onClick={()=>load(q)}>جستجو</button>
      </div>

      {loading ? 'در حال بارگذاری…' : (
        <>
          <div className="text-sm text-gray-500 mb-2">تعداد: {total}</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="p-2 text-right">کد</th>
                  <th className="p-2 text-right">نام</th>
                  <th className="p-2 text-right">واحد</th>
                  <th className="p-2 text-right">دسته</th>
                  <th className="p-2 text-right">موجودی</th>
                  <th className="p-2 text-right">ارزش</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r:any) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2 font-mono">{r.code}</td>
                    <td className="p-2">{r.nameFa}</td>
                    <td className="p-2">{r.unit ?? '-'}</td>
                    <td className="p-2">{r.category ?? '-'}</td>
                    <td className="p-2" dir="ltr">{r.currentQty ?? '-'}</td>
                    <td className="p-2" dir="ltr">{r.currentValue ?? '-'}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={6} className="p-6 text-center text-gray-500">موردی یافت نشد</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
