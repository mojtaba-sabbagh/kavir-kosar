'use client';
import { useEffect, useState } from 'react';

type Row = {
  id: string;
  code: string;
  nameFa: string;
  openingQty?: number | null;
  storage?: string | null;
  currentQty?: number | null;
  orderPoint?: number | null;
};

export default function AdminKardexClient() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newRow, setNewRow] = useState<{code:string;nameFa:string;storage?:string;currentQty?:number;openingQty?:number;orderPoint?:number;}>({ code:'', nameFa:'' });

  const load = async (query='') => {
    setLoading(true);
    const res = await fetch(`/api/reports/kardex?q=${encodeURIComponent(query)}`, { cache: 'no-store' });
    const j = await res.json();
    setRows(j.items ?? []);
    setLoading(false);
  };
  useEffect(() => { load(''); }, []);

  const saveCell = async (id: string, patch: Partial<Row>) => {
    const res = await fetch(`/api/admin/kardex/${id}`, {
      method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(patch),
    });
    if (!res.ok) alert((await res.json().catch(()=>({}))).message || 'خطا در ذخیره');
  };

  const delRow = async (id: string) => {
    if (!confirm('حذف این ردیف؟')) return;
    const res = await fetch(`/api/admin/kardex/${id}`, { method:'DELETE' });
    if (res.ok) setRows(prev => prev.filter(r => r.id !== id));
    else alert((await res.json().catch(()=>({}))).message || 'خطا در حذف');
  };

  const addRow = async () => {
    if (!newRow.code || !newRow.nameFa) { alert('کد و نام اجباری است'); return; }
    setAdding(true);
    const res = await fetch('/api/admin/kardex', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(newRow),
    });
    setAdding(false);
    if (res.ok) { setNewRow({ code:'', nameFa:'' }); await load(q); }
    else alert((await res.json().catch(()=>({}))).message || 'خطا در ایجاد');
  };

  const numOrUndef = (v: string) => {
  if (v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
  };


  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">مدیریت کاردکس</h1>

      <div className="rounded-xl border bg-white p-4 space-y-3">
        <div className="flex gap-2">
          <input className="flex-1 border rounded-md px-3 py-2" placeholder="جستجو نام کالا…" value={q} onChange={e=>setQ(e.target.value)} />
          <button className="border rounded-md px-3 py-2 hover:bg-gray-50" onClick={()=>load(q)}>جستجو</button>
        </div>

        {/* Add new row */}
        <div className="border rounded-lg p-3 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <input
              className="border rounded px-2 py-1 font-mono"
              dir="ltr"
              placeholder="کد"
              value={newRow.code}
              onChange={e => setNewRow({ ...newRow, code: e.target.value })}
            />

            <input
              className="border rounded px-2 py-1"
              placeholder="نام کالا"
              value={newRow.nameFa}
              onChange={e => setNewRow({ ...newRow, nameFa: e.target.value })}
            />

            {/* ✅ parse to number (or undefined) */}
            <input
              type="number"
              step="1"
              className="border rounded px-2 py-1"
              dir="ltr"
              placeholder="موجودی"
              value={newRow.currentQty ?? ''}                           // display
              onChange={e => setNewRow({ ...newRow, currentQty: numOrUndef(e.target.value) })} // state
            />

            {/* ✅ parse to number (or undefined) */}
            <input
              type="number"
              step="1"
              className="border rounded px-2 py-1"
              dir="ltr"
              placeholder="موجودی ابتدای دوره"
              value={newRow.openingQty ?? ''}
              onChange={e => setNewRow({ ...newRow, openingQty: numOrUndef(e.target.value) })}
            />

            {/* ✅ make controlled with fallback */}
            <input
              className="border rounded px-2 py-1"
              placeholder="انبار"
              value={newRow.storage ?? ''}
              onChange={e => setNewRow({ ...newRow, storage: e.target.value })}
            />

            {/* ✅ parse to number (or undefined) */}
            <input
              type="number"
              step="1"
              className="border rounded px-2 py-1"
              dir="ltr"
              placeholder="نقطه سفارش"
              value={newRow.orderPoint ?? ''}
              onChange={e => setNewRow({ ...newRow, orderPoint: numOrUndef(e.target.value) })}
            />
          </div>
          <div className="text-left">
            <button disabled={adding} onClick={addRow} className="rounded-md bg-blue-600 text-white px-4 py-2 disabled:opacity-50">
              {adding ? 'در حال افزودن…' : 'افزودن'}
            </button>
          </div>
        </div>

        {/* Grid */}
        {loading ? 'در حال بارگذاری…' : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-center">
                  <th className="p-2">کد</th>
                  <th className="p-2">نام</th>
                  <th className="p-2">موجودی</th>
                  <th className="p-2">موجودی ابتدای دوره</th>
                  <th className="p-2">انبار</th>
                  <th className="p-2">نقطه سفارش</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((it) => (
                  <tr key={it.id} className="border-t">
                    <td className="p-2 font-mono">{it.code}</td>
                    <td className="p-2">
                      <input className="border rounded px-2 py-1 w-full" value={it.nameFa ?? ''} onChange={e=>setRows(prev => prev.map(p => p.id===it.id ? { ...p, nameFa: e.target.value } : p))} onBlur={()=>saveCell(it.id, { nameFa: it.nameFa })} />
                    </td>
                    <td className="p-2">
                      <input type="number" step="1" className="border rounded px-2 py-1 w-28" value={it.currentQty ?? ''} onChange={e=>setRows(prev => prev.map(p => p.id===it.id ? { ...p, currentQty: e.target.value === '' ? null : Number(e.target.value) } : p))} onBlur={()=>saveCell(it.id, { currentQty: typeof it.currentQty === 'number' ? it.currentQty : null })} />
                    </td>
                    <td className="p-2">
                      <input type="number" step="1" className="border rounded px-2 py-1 w-28" value={it.openingQty ?? ''} onChange={e=>setRows(prev => prev.map(p => p.id===it.id ? { ...p, openingQty: e.target.value === '' ? null : Number(e.target.value) } : p))} onBlur={()=>saveCell(it.id, { openingQty: typeof it.openingQty === 'number' ? it.openingQty : null })} />
                    </td>
                    <td className="p-2" dir="ltr">
                      <input className="border rounded px-2 py-1 w-full" value={it.storage ?? ''} onChange={e=>setRows(prev => prev.map(p => p.id===it.id ? { ...p, storage: e.target.value } : p))} onBlur={()=>saveCell(it.id, { storage: it.storage })} />
                    </td>
                    <td className="p-2" dir="ltr">
                      <input type="number" step="1" className="border rounded px-2 py-1 w-28" value={it.orderPoint ?? ''} onChange={e=>setRows(prev => prev.map(p => p.id===it.id ? { ...p, orderPoint: e.target.value === '' ? null : Number(e.target.value) } : p))} onBlur={()=>saveCell(it.id, { orderPoint: typeof it.orderPoint === 'number' ? it.orderPoint : null })} />
                    </td>
                    <td className="p-2 text-left">
                      <button onClick={()=>delRow(it.id)} className="text-red-600 text-xs hover:underline">حذف</button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-gray-500">موردی یافت نشد</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
