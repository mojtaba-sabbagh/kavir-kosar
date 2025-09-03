'use client';
import { useEffect, useState } from 'react';

type Row = {
  id: string;
  code: string;
  nameFa: string;
  unit?: string | null;
  category?: string | null;
  currentQty?: number | null;
  currentValue?: number | null;
};

export default function AdminKardexClient() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newRow, setNewRow] = useState<{code:string;nameFa:string;unit?:string;category?:string}>({ code:'', nameFa:'' });

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
            <input className="border rounded px-2 py-1 font-mono" dir="ltr" placeholder="کد" value={newRow.code} onChange={e=>setNewRow({...newRow, code:e.target.value})} />
            <input className="border rounded px-2 py-1" placeholder="نام" value={newRow.nameFa} onChange={e=>setNewRow({...newRow, nameFa:e.target.value})} />
            <input className="border rounded px-2 py-1" placeholder="واحد" value={newRow.unit ?? ''} onChange={e=>setNewRow({...newRow, unit:e.target.value})} />
            <input className="border rounded px-2 py-1" placeholder="دسته" value={newRow.category ?? ''} onChange={e=>setNewRow({...newRow, category:e.target.value})} />
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
                  <th className="p-2">واحد</th>
                  <th className="p-2">دسته</th>
                  <th className="p-2">موجودی</th>
                  <th className="p-2">ارزش</th>
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
                      <input className="border rounded px-2 py-1 w-24" value={it.unit ?? ''} onChange={e=>setRows(prev => prev.map(p => p.id===it.id ? { ...p, unit: e.target.value } : p))} onBlur={()=>saveCell(it.id, { unit: it.unit })} />
                    </td>
                    <td className="p-2">
                      <input className="border rounded px-2 py-1 w-32" value={it.category ?? ''} onChange={e=>setRows(prev => prev.map(p => p.id===it.id ? { ...p, category: e.target.value } : p))} onBlur={()=>saveCell(it.id, { category: it.category })} />
                    </td>
                    <td className="p-2" dir="ltr">
                      <input type="number" step="1" className="border rounded px-2 py-1 w-28" value={it.currentQty ?? ''} onChange={e=>setRows(prev => prev.map(p => p.id===it.id ? { ...p, currentQty: e.target.value === '' ? null : Number(e.target.value) } : p))} onBlur={()=>saveCell(it.id, { currentQty: typeof it.currentQty === 'number' ? it.currentQty : null })} />
                    </td>
                    <td className="p-2" dir="ltr">
                      <input type="number" step="1" className="border rounded px-2 py-1 w-28" value={it.currentValue ?? ''} onChange={e=>setRows(prev => prev.map(p => p.id===it.id ? { ...p, currentValue: e.target.value === '' ? null : Number(e.target.value) } : p))} onBlur={()=>saveCell(it.id, { currentValue: typeof it.currentValue === 'number' ? it.currentValue : null })} />
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
