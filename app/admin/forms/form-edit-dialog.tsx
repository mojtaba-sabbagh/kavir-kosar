'use client';

import { useState } from 'react';

export default function FormEditDialog({
  form,
}: {
  form: { id: string; code: string; titleFa: string; sortOrder: number; isActive: boolean };
}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(form.code);
  const [titleFa, setTitleFa] = useState(form.titleFa);
  const [sortOrder, setSortOrder] = useState<number>(form.sortOrder ?? 100);
  const [isActive, setIsActive] = useState<boolean>(!!form.isActive);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/forms/${form.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: code.trim(),
        titleFa: titleFa.trim(),
        sortOrder: Number(sortOrder),
        isActive,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setOpen(false);
      location.reload(); // simplest; you can switch to router.refresh()
      return;
    }
    try {
      const data = await res.json();
      setError(data?.message || 'ویرایش فرم ناموفق بود');
    } catch {
      setError('ویرایش فرم ناموفق بود');
    }
  };

  return (
    <>
      <button className="rounded-md border px-3 py-1 hover:bg-gray-50" onClick={() => setOpen(true)}>
        ویرایش
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-lg">
            <h3 className="text-lg font-bold mb-4">ویرایش فرم</h3>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm">کد فرم</label>
                <input
                  className="w-full rounded-md border px-3 py-2"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="مثلاً HR-REQ-01"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm">عنوان فارسی</label>
                <input
                  className="w-full rounded-md border px-3 py-2"
                  value={titleFa}
                  onChange={(e) => setTitleFa(e.target.value)}
                  placeholder="عنوان فرم"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm">ترتیب نمایش</label>
                <input
                  type="number"
                  className="w-full rounded-md border px-3 py-2"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(parseInt(e.target.value || '0'))}
                />
              </div>
              <div className="flex items-center gap-2 mt-6">
                <input id={`active-${form.id}`} type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                <label htmlFor={`active-${form.id}`} className="text-sm">فعال</label>
              </div>
            </div>

            {error && (
              <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 border border-red-200">
                {error}
              </div>
            )}

            <div className="mt-6 flex items-center justify-between">
              <button className="rounded-md px-3 py-2 hover:bg-gray-100" onClick={() => setOpen(false)}>
                بستن
              </button>
              <button
                onClick={save}
                disabled={saving || !code.trim() || !titleFa.trim()}
                className="rounded-md bg-gray-900 text-white px-4 py-2 disabled:opacity-50"
              >
                {saving ? 'در حال ذخیره…' : 'ذخیره'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
