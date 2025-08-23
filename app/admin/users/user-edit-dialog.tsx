'use client';

import { useState } from 'react';

type Role = { id: string; name: string };
type UserRow = { id: string; email: string; name: string | null; roles: { roleId: string; role: Role }[] };

export default function UserEditDialog({
  user,
  allRoles,
  onSaved,
}: {
  user: UserRow;
  allRoles: Role[];
  onSaved?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(user.email);
  const [name, setName] = useState(user.name ?? '');
  const [password, setPassword] = useState(''); // optional reset
  const [roleIds, setRoleIds] = useState<string[]>(user.roles.map(r => r.roleId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleRole = (id: string) =>
    setRoleIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const save = async () => {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        name: name || null,
        password: password || undefined, // only resets if provided
        roleIds,
      }),
    });
    setSaving(false);

    if (res.ok) {
      setOpen(false);
      onSaved?.();
      // simplest: reload to see latest table
      location.reload();
    } else {
      try {
        const data = await res.json();
        setError(data?.message || 'ویرایش ناموفق بود');
      } catch {
        setError('ویرایش ناموفق بود');
      }
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
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg">
            <div className="mb-4">
              <h3 className="text-lg font-bold">ویرایش کاربر</h3>
              <p className="text-xs text-gray-500 mt-1">تغییر ایمیل، نام، رمز عبور و گروه‌ها</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm">ایمیل</label>
                <input
                  dir="ltr"
                  className="w-full rounded-md border px-3 py-2"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="user@example.com"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm">نام</label>
                <input
                  className="w-full rounded-md border px-3 py-2"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="نام و نام خانوادگی"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm">تغییر رمز عبور (اختیاری)</label>
                <input
                  type="password"
                  className="w-full rounded-md border px-3 py-2"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="در صورت خالی، رمز فعلی حفظ می‌شود"
                />
              </div>

              <div className="sm:col-span-2">
                <div className="mb-1 text-sm text-gray-600">گروه‌ها</div>
                <div className="flex flex-wrap gap-4">
                  {allRoles.map(r => (
                    <label key={r.id} className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={roleIds.includes(r.id)}
                        onChange={() => toggleRole(r.id)}
                      />
                      <span>{r.name}</span>
                    </label>
                  ))}
                  {allRoles.length === 0 && (
                    <div className="text-gray-500 text-sm">ابتدا در بخش «گروه‌ها» نقش بسازید.</div>
                  )}
                </div>
              </div>
            </div>

            {error && <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 border border-red-200">{error}</div>}

            <div className="mt-6 flex items-center justify-between">
              <button className="rounded-md px-3 py-2 hover:bg-gray-100" onClick={() => setOpen(false)}>
                بستن
              </button>
              <button
                onClick={save}
                disabled={saving}
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
