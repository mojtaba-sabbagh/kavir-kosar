'use client';

import { useState } from 'react';

export default function RoleEditDialog({
  roleId,
  currentName,
}: {
  roleId: string;
  currentName: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/roles/${roleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    setSaving(false);

    if (res.ok) {
      setOpen(false);
      location.reload(); // simplest; you can switch to router.refresh()
      return;
    }
    try {
      const data = await res.json();
      setError(data?.message || 'ویرایش نقش ناموفق بود');
    } catch {
      setError('ویرایش نقش ناموفق بود');
    }
  };

  return (
    <>
      <button
        className="rounded-md border px-3 py-1 hover:bg-gray-50"
        onClick={() => setOpen(true)}
      >
        ویرایش
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
            <h3 className="text-lg font-bold mb-3">ویرایش نقش</h3>

            <label className="mb-1 block text-sm">نام نقش</label>
            <input
              className="w-full rounded-md border px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثلاً manager"
              autoFocus
            />

            {error && (
              <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 border border-red-200">
                {error}
              </div>
            )}

            <div className="mt-5 flex items-center justify-between">
              <button className="rounded-md px-3 py-2 hover:bg-gray-100" onClick={() => setOpen(false)}>
                بستن
              </button>
              <button
                onClick={save}
                disabled={saving || !name.trim()}
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
