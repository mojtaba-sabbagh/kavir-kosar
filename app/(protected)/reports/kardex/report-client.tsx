'use client';
import { useEffect, useRef, useState } from 'react';

type KardexRow = {
  id: string;
  code: string;
  nameFa: string;
  unit?: string | null;
  category?: string | null;
  currentQty?: number | null;
  currentValue?: number | null;
};

export default function KardexReportClient() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<KardexRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // cancel any in-flight request
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    const url = `/api/reports/kardex?q=${encodeURIComponent(q)}&limit=500`;

    fetch(url, { signal: ac.signal, cache: 'no-store' })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        // Expecting { items: KardexRow[], total: number }
        setRows(Array.isArray(j.items) ? (j.items as KardexRow[]) : []);
        setTotal(typeof j.total === 'number' ? j.total : (Array.isArray(j.items) ? j.items.length : 0));
      })
      .catch((err) => {
        // ignore abort errors
        if (err?.name !== 'AbortError') {
          console.error('Kardex load error:', err);
          setRows([]);
          setTotal(0);
        }
      })
      .finally(() => setLoading(false));

    return () => ac.abort();
  }, [q, refreshTick]);

  const searchNow = () => setRefreshTick((x) => x + 1);

  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="flex gap-2 mb-3">
        <input
          className="flex-1 border rounded-md px-3 py-2"
          placeholder="جستجو بر اساس نام یا کد کالا…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          className="border rounded-md px-3 py-2 hover:bg-gray-50"
          onClick={searchNow}
          disabled={loading}
        >
          جستجو
        </button>
      </div>

      {loading ? (
        'در حال بارگذاری…'
      ) : (
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
                {rows.map((r) => (
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
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-gray-500">
                      موردی یافت نشد
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
