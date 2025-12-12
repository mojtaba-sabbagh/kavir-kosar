'use client';

import { useEffect, useMemo, useState } from 'react';

type Row = { id: string; code: string; title: string; type: string; description?: string | null };

export default function FixedInfoManager() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [types, setTypes] = useState<string[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const pageSize = 20;

  // form state for create/edit
  const [editing, setEditing] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (type) p.set('type', type);
    p.set('page', String(page));
    p.set('pageSize', String(pageSize));
    return `?${p.toString()}`;
  }, [q, type, page]);

  // Load distinct types on mount
  useEffect(() => {
    const loadTypes = async () => {
      setLoadingTypes(true);
      try {
        const res = await fetch('/api/table-select/types?table=fixedInformation', { cache: 'no-store' });
        const j = await res.json();
        if (res.ok && j.ok) {
          setTypes(j.types || []);
        }
      } catch (e) {
        console.error('Failed to load types:', e);
      } finally {
        setLoadingTypes(false);
      }
    };
    loadTypes();
  }, []);

  const load = async () => {
    const res = await fetch(`/api/admin/fixed-info${qs}`, { cache: 'no-store' });
    const j = await res.json();
    if (res.ok && j.ok) { setRows(j.rows || []); setTotal(j.total || 0); }
  };

  useEffect(() => { load(); }, [qs]);

  const resetForm = () => setEditing({ id: '', code: '', title: '', type: '', description: '' });

  const save = async () => {
    if (!editing) return;
    setSaving(true); setErr(null);
    try {
      const payload = { code: editing.code, title: editing.title, type: editing.type, description: editing.description ?? '' };
      let res: Response;
      if (editing.id) {
        res = await fetch(`/api/admin/fixed-info/${editing.id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      } else {
        res = await fetch(`/api/admin/fixed-info`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      }
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.message || 'خطا در ذخیره');
      setEditing(null);
      load();
    } catch (e: any) {
      setErr(e?.message || 'خطا');
    } finally {
      setSaving(false);
    }
  };

  const del = async (id: string) => {
    if (!confirm('حذف شود؟')) return;
    const res = await fetch(`/api/admin/fixed-info/${id}`, { method: 'DELETE' });
    if (res.ok) load();
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="rounded-xl border bg-white p-3 flex flex-wrap items-end gap-3" dir="rtl">
        <div className="flex-1 min-w-60">
          <label className="block text-sm mb-1">جستجو در عنوان</label>
          <input className="w-full border rounded-md px-3 py-2" placeholder="نام یا کد..." value={q} onChange={e=>{ setPage(1); setQ(e.target.value); }} />
        </div>
        <div className="w-60">
          <label className="block text-sm mb-1">نوع</label>
          <select 
            className="w-full border rounded-md px-3 py-2"
            title="فیلتر بر اساس نوع"
            value={type} 
            onChange={e=>{ setPage(1); setType(e.target.value); }}
            disabled={loadingTypes}
          >
            <option value="">— همه انواع —</option>
            {types.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <button className="ms-auto rounded-md border px-3 py-2 hover:bg-gray-50" onClick={resetForm}>افزودن مورد جدید</button>
      </div>

      {/* Form (create/edit) */}
      {editing && (
        <div className="rounded-xl border bg-white p-3 space-y-3" dir="rtl">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-sm mb-1">کد</label>
              <input className="w-full border rounded-md px-3 py-2" value={editing.code} onChange={e=>setEditing({...editing, code: e.target.value})}/>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm mb-1">عنوان</label>
              <input className="w-full border rounded-md px-3 py-2" value={editing.title} onChange={e=>setEditing({...editing, title: e.target.value})}/>
            </div>
            <div>
              <label className="block text-sm mb-1">نوع</label>
              <input className="w-full border rounded-md px-3 py-2" value={editing.type} onChange={e=>setEditing({...editing, type: e.target.value})}/>
            </div>
            <div className="md:col-span-4">
              <label className="block text-sm mb-1">توضیحات</label>
              <input className="w-full border rounded-md px-3 py-2" value={editing.description ?? ''} onChange={e=>setEditing({...editing, description: e.target.value})}/>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button disabled={saving} onClick={save} className="rounded-md bg-blue-600 text-white px-4 py-2 disabled:opacity-50">
              {saving ? 'در حال ذخیره…' : 'ذخیره'}
            </button>
            <button onClick={()=>setEditing(null)} className="rounded-md border px-4 py-2">لغو</button>
            {err && <span className="text-red-600 text-sm">{err}</span>}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border bg-white overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="p-2 text-right">کد</th>
              <th className="p-2 text-right">عنوان</th>
              <th className="p-2 text-right">نوع</th>
              <th className="p-2 text-right">توضیحات</th>
              <th className="p-2 text-right">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t">
                <td className="p-2 ltr">{r.code}</td>
                <td className="p-2">{r.title}</td>
                <td className="p-2">{r.type}</td>
                <td className="p-2">{r.description ?? ''}</td>
                <td className="p-2">
                  <div className="flex gap-2">
                    <button className="text-blue-600 hover:underline" onClick={()=>setEditing(r)}>ویرایش</button>
                    <button className="text-red-600 hover:underline" onClick={()=>del(r.id)}>حذف</button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td className="p-4 text-center text-gray-500" colSpan={5}>موردی یافت نشد</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center gap-2">
        <button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="rounded-md border px-3 py-1 disabled:opacity-50">قبلی</button>
        <div className="text-xs text-gray-600">صفحه {page} از {totalPages}</div>
        <button disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)} className="rounded-md border px-3 py-1 disabled:opacity-50">بعدی</button>
      </div>
    </div>
  );
}
