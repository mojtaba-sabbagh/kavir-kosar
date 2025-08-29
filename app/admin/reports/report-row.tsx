'use client';

import { useState } from 'react';

export type ReportRowData = {
  id: string;
  code: string;
  titleFa: string;
  url: string | null;
  sortOrder: number;
  isActive: boolean;
};

export default function ReportRow({ r }: { r: ReportRowData }) {
  const [edit, setEdit] = useState(false);
  const [code, setCode] = useState(r.code);
  const [titleFa, setTitleFa] = useState(r.titleFa);
  const [url, setUrl] = useState(r.url ?? '');
  const [sortOrder, setSortOrder] = useState<number>(r.sortOrder ?? 100);
  const [isActive, setIsActive] = useState<boolean>(!!r.isActive);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const res = await fetch(`/api/admin/reports/${r.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        titleFa,
        url: url.trim() ? url.trim() : null,
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : 100,
        isActive,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      try { alert((await res.json())?.message || 'ذخیره ناموفق بود'); } catch { alert('ذخیره ناموفق بود'); }
      return;
    }
    setEdit(false);
    // Refresh the row data visually (simple way):
    location.reload();
  };

  if (!edit) {
    return (
      <tr className="border-t">
        <td className="py-2">{r.code}</td>
        <td className="py-2">{r.titleFa}</td>
        <td className="py-2">{r.url ?? '—'}</td>
        <td className="py-2">{r.sortOrder}</td>
        <td className="py-2">{r.isActive ? 'بله' : 'خیر'}</td>
        <td className="py-2 flex items-center gap-2">
          <button onClick={() => setEdit(true)} className="rounded-md border px-3 py-1 hover:bg-gray-50">ویرایش</button>
          <form action={`/api/admin/reports/${r.id}`} method="post" onSubmit={(e) => {
            if (!confirm('آیا از حذف گزارش مطمئن هستید؟')) e.preventDefault();
          }}>
            <input type="hidden" name="_method" value="DELETE" />
            <button className="rounded-md border px-3 py-1 text-red-600 hover:bg-red-50">حذف</button>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t bg-gray-50">
      <td className="py-2">
        <input className="w-full rounded-md border px-2 py-1" value={code} onChange={e=>setCode(e.target.value)} />
      </td>
      <td className="py-2">
        <input className="w-full rounded-md border px-2 py-1" value={titleFa} onChange={e=>setTitleFa(e.target.value)} />
      </td>
      <td className="py-2">
        {/* LTR URL field */}
        <input
          className="w-full rounded-md border px-2 py-1"
          value={url}
          onChange={e=>setUrl(e.target.value)}
          dir="ltr"
          inputMode="url"
          autoComplete="url"
          placeholder="/reports/sales-daily یا https://…"
        />
      </td>
      <td className="py-2">
        <input
            type="number"
            className="w-24 rounded-md border px-2 py-1 text-right" // ← compact width (~6rem)
            value={Number.isFinite(sortOrder) ? sortOrder : 0}
            onChange={(e) => setSortOrder(parseInt(e.target.value || '0', 10))}
            inputMode="numeric"
        />
      </td>
      <td className="py-2">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={isActive} onChange={e=>setIsActive(e.target.checked)} />
          <span>فعال</span>
        </label>
      </td>
      <td className="py-2 flex items-center gap-2">
        <button onClick={save} disabled={saving} className="rounded-md bg-gray-900 text-white px-3 py-1 disabled:opacity-50">
          {saving ? 'در حال ذخیره…' : 'ذخیره'}
        </button>
        <button onClick={() => setEdit(false)} className="rounded-md border px-3 py-1 hover:bg-gray-100">انصراف</button>
      </td>
    </tr>
  );
}
