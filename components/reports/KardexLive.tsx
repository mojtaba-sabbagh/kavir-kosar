'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Row = { id: string; code: string; nameFa: string; unit: string | null; currentQty: string | number | null };

export default function KardexLive() {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false); // to hide "no result" before first input
  const ctrl = useRef<AbortController | null>(null);

  // debounce
  const debouncedQ = useDebounce(q, 300);

  useEffect(() => {
  ctrl.current?.abort();
  const ac = new AbortController();
  ctrl.current = ac;

  setLoading(true);
  const url = q.trim()
    ? `/api/kardex/search?q=${encodeURIComponent(q)}&limit=50`
    : `/api/kardex/search?limit=100`; // 👈 fetch all when empty

  fetch(url, { signal: ac.signal })
    .then(r => r.json())
    .then(j => setItems(j.items ?? []))
    .catch(() => {})
    .finally(() => setLoading(false));

  return () => ac.abort();
}, [q]);


  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center gap-2">
        <input
          className="w-full rounded-md border px-3 py-2"
          placeholder="جستجو در نام یا کد کالا…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {loading && <span className="text-xs text-gray-500">در حال جستجو…</span>}
      </div>

      {/* Results */}
      {items.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-center text-gray-600">
                <th className="p-2">نام کالا</th>
                <th className="p-2">کد</th>
                <th className="p-2">واحد</th>
                <th className="p-2">موجودی</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-t">
                  <td className="p-2">{it.nameFa}</td>
                  <td className="p-2 font-mono text-center" dir="ltr">{it.code}</td>
                  <td className="p-2 text-center">{it.unit ?? '—'}</td>
                  <td className="p-2 font-mono text-center" dir="ltr">{it.currentQty ?? '0'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        touched && !loading && (
          <div className="text-sm text-gray-500">نتیجه‌ای یافت نشد</div>
        )
      )}
    </div>
  );
}

function useDebounce<T>(value: T, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
