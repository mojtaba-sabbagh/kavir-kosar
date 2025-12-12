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
  extra?: Record<string, any> | null; // ⬅️ hold JSON (e.g., { weight: 2.5, ... })
};

export default function AdminKardexClient() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newRow, setNewRow] = useState<{
    code: string;
    nameFa: string;
    storage?: string;
    currentQty?: number;
    openingQty?: number;
    orderPoint?: number;
    extra?: { weight?: number | null };
  }>({ code: '', nameFa: '' });

  const load = async (query = '') => {
    setLoading(true);
    const res = await fetch(`/api/reports/kardex?q=${encodeURIComponent(query)}`, { cache: 'no-store' });
    const j = await res.json();
    setRows((j.items ?? []).map((it: Row) => ({ ...it, extra: it.extra ?? null })));
    setLoading(false);
  };
  useEffect(() => { load(''); }, []);

  const saveCell = async (id: string, patch: Partial<Row>) => {
    const res = await fetch(`/api/admin/kardex/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) alert((await res.json().catch(() => ({}))).message || 'خطا در ذخیره');
  };

  const delRow = async (id: string) => {
    if (!confirm('حذف این ردیف؟')) return;
    const res = await fetch(`/api/admin/kardex/${id}`, { method: 'DELETE' });
    if (res.ok) setRows(prev => prev.filter(r => r.id !== id));
    else alert((await res.json().catch(() => ({}))).message || 'خطا در حذف');
  };

  const addRow = async () => {
    if (!newRow.code || !newRow.nameFa) { alert('کد و نام اجباری است'); return; }
    setAdding(true);

    // Build payload; only include extra.weight if it’s a finite number; save null if explicitly empty.
    const weight = newRow.extra?.weight;
    const includeWeight = typeof weight === 'number' && Number.isFinite(weight);
    const payload: any = {
      code: newRow.code,
      nameFa: newRow.nameFa,
      storage: newRow.storage ?? undefined,
      currentQty: newRow.currentQty ?? undefined,
      openingQty: newRow.openingQty ?? undefined,
      orderPoint: newRow.orderPoint ?? undefined,
      ...(includeWeight ? { extra: { weight } } : {}),
    };

    const res = await fetch('/api/admin/kardex', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setAdding(false);
    if (res.ok) {
      setNewRow({ code: '', nameFa: '' });
      await load(q);
    } else {
      alert((await res.json().catch(() => ({}))).message || 'خطا در ایجاد');
    }
  };

  const numOrUndef = (v: string) => {
    if (v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  const normalizeWeightForSave = (w: unknown): number | null => {
    return typeof w === 'number' && Number.isFinite(w) ? w : null;
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">مدیریت کاردکس</h1>

      <div className="rounded-xl border bg-white p-4 space-y-3">
        <div className="flex gap-2">
          <input
            className="flex-1 border rounded-md px-3 py-2"
            placeholder="جستجو نام کالا…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          <button className="border rounded-md px-3 py-2 hover:bg-gray-50" onClick={() => load(q)}>جستجو</button>
        </div>

        {/* Add new row */}
        <div className="border rounded-lg p-3 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
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

            <input
              type="number" step="1" dir="ltr"
              className="border rounded px-2 py-1"
              placeholder="موجودی"
              value={newRow.currentQty ?? ''}
              onChange={e => setNewRow({ ...newRow, currentQty: numOrUndef(e.target.value) })}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <input
              type="number" step="1" dir="ltr"
              className="border rounded px-2 py-1"
              placeholder="موجودی ابتدای دوره"
              value={newRow.openingQty ?? ''}
              onChange={e => setNewRow({ ...newRow, openingQty: numOrUndef(e.target.value) })}
            />
            <input
              type="number" step="0.001" dir="ltr"
              className="border rounded px-2 py-1"
              placeholder="وزن واحد"
              value={typeof newRow.extra?.weight === 'number' ? newRow.extra.weight : ''}
              onChange={e => {
                const v = e.target.value;
                const w = v === '' ? undefined : Number(v);
                setNewRow(prev => ({
                  ...prev,
                  extra: { ...(prev.extra ?? {}), weight: typeof w === 'number' && Number.isFinite(w) ? w : undefined },
                }));
              }}
            />
            <input
              className="border rounded px-2 py-1"
              placeholder="انبار"
              dir="rtl"
              value={newRow.storage ?? ''}
              onChange={e => setNewRow({ ...newRow, storage: e.target.value })}
            />

            <input
              type="number" step="1" dir="ltr"
              className="border rounded px-2 py-1"
              placeholder="نقطه سفارش"
              value={newRow.orderPoint ?? ''}
              onChange={e => setNewRow({ ...newRow, orderPoint: numOrUndef(e.target.value) })}
            />
          </div>
          <div className="text-left">
            <button
              disabled={adding}
              onClick={addRow}
              className="rounded-md bg-blue-600 text-white px-4 py-2 disabled:opacity-50"
            >
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
                {['ردیف','کد','نام','موجودی','موجودی ابتدای دوره','انبار','نقطه سفارش','وزن واحد',''].map((h, i) => (
                  <th key={i} className="p-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((it, idx) => (
                <tr key={it.id} className="border-t">
                  {/* Index column */}
                  <td className="p-2 text-center w-12 min-w-12 font-medium">
                    {idx + 1}
                  </td>

                  {/* Reduced width for code column */}
                  <td className="p-2 font-mono w-30 min-w-30">
                    <input
                      className="border rounded px-2 py-1 w-full"
                      value={it.code ?? ''}
                      onChange={e => setRows(prev => prev.map(p => p.id === it.id ? { ...p, code: e.target.value } : p))}
                      onBlur={(e) => saveCell(it.id, { code: e.currentTarget.value })}
                    />
                  </td>

                  {/* Increased width for nameFa column */}
                  <td className="p-2 min-w-70">
                    <input
                      className="border rounded px-2 py-1 w-full"
                      value={it.nameFa ?? ''}
                      onChange={e => setRows(prev => prev.map(p => p.id === it.id ? { ...p, nameFa: e.target.value } : p))}
                      onBlur={(e) => saveCell(it.id, { nameFa: e.currentTarget.value })}
                    />
                  </td>

                  {/* Reduced width for quantity columns */}
                  <td className="p-2 w-24 min-w-24" dir="ltr">
                    <input
                      type="number" step="1" dir="ltr"
                      className="border rounded px-2 py-1 w-full"
                      value={it.currentQty ?? ''}
                      onChange={e => setRows(prev => prev.map(p => p.id === it.id ? { ...p, currentQty: e.target.value === '' ? null : Number(e.target.value) } : p))}
                      onBlur={(e) => {
                        const v = e.currentTarget.value;
                        const n = v === '' ? null : Number(v);
                        saveCell(it.id, { currentQty: Number.isFinite(n as number) ? (n as number) : null });
                      }}                 
                    />
                  </td>

                  <td className="p-2 w-24 min-w-24" dir="ltr">
                    <input
                      type="number" step="1" dir="ltr"
                      className="border rounded px-2 py-1 w-full"
                      value={it.openingQty ?? ''}
                      onChange={e => setRows(prev => prev.map(p => p.id === it.id ? { ...p, openingQty: e.target.value === '' ? null : Number(e.target.value) } : p))}
                      onBlur={(e) => {
                        const v = e.currentTarget.value;
                        const n = v === '' ? null : Number(v);
                        saveCell(it.id, { openingQty: Number.isFinite(n as number) ? (n as number) : null });
                      }}                    
                    />
                  </td>

                  {/* Medium width for storage */}
                  <td className="p-2 w-38 min-w-38">
                    <input
                      className="border rounded px-2 py-1 w-full"
                      value={it.storage ?? ''}
                      onChange={e => setRows(prev => prev.map(p => p.id === it.id ? { ...p, storage: e.target.value } : p))}
                      onBlur={(e) => saveCell(it.id, { storage: e.currentTarget.value })}
                    />
                  </td>

                  {/* Reduced width for order point */}
                  <td className="p-2 w-24 min-w-24" dir="ltr">
                    <input
                      type="number" step="1" dir="ltr"
                      className="border rounded px-2 py-1 w-full"
                      value={it.orderPoint ?? ''}
                      onChange={e => setRows(prev => prev.map(p => p.id === it.id ? { ...p, orderPoint: e.target.value === '' ? null : Number(e.target.value) } : p))}
                      onBlur={(e) => {
                        const v = e.currentTarget.value;
                        const n = v === '' ? null : Number(v);
                        saveCell(it.id, { orderPoint: Number.isFinite(n as number) ? (n as number) : null });
                      }}                   
                    />
                  </td>

                  {/* Reduced width for weight */}
                  <td className="p-2 w-24 min-w-24" dir="ltr">
                    <input
                      type="number" step="1" dir="ltr"
                      className="border rounded px-2 py-1 w-full"
                      placeholder="2.5"
                      value={typeof it.extra?.weight === 'number' ? it.extra.weight : ''}
                      onChange={e => {
                        const v = e.target.value;
                        setRows(prev => prev.map(p =>
                          p.id === it.id
                            ? { ...p, extra: { ...(p.extra ?? {}), weight: v === '' ? undefined : Number(v) } }
                            : p
                        ));
                      }}
                      onBlur={(e) => {
                        const v = e.currentTarget.value;
                        const n = v === '' ? null : Number(v);
                        saveCell(it.id, { extra: { weight: Number.isFinite(n as number) ? (n as number) : null } as any });
                      }}
                    />
                  </td>

                  {/* Fixed width for delete button */}
                  <td className="p-2 w-10 min-w-10 text-left">
                    <button onClick={() => delRow(it.id)} className="text-red-600 text-xs hover:underline">حذف</button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-gray-500">موردی یافت نشد</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        )}
      </div>
    </div>
  );
}
