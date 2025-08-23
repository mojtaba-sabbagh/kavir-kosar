'use client';

import { useMemo, useState } from 'react';

type Role = { id: string; name: string };

export default function UsersCreateForm({ allRoles }: { allRoles: Role[] }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pwMismatch = useMemo(
    () => password.length > 0 && passwordConfirm.length > 0 && password !== passwordConfirm,
    [password, passwordConfirm]
  );

  const canSubmit = useMemo(() => {
    return (
      !saving &&
      email.trim().length > 0 &&
      password.length >= 6 &&
      passwordConfirm.length >= 1 &&
      !pwMismatch
    );
  }, [saving, email, password, passwordConfirm, pwMismatch]);

  const toggleRole = (id: string) => {
    setRoleIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);

    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        name: name || null,
        password,
        passwordConfirm,
        roleIds,
      }),
    });

    setSaving(false);
    if (res.ok) {
      alert('کاربر ایجاد شد.');
      location.reload();
    } else {
      try {
        const err = await res.json();
        setError(err?.message || 'ثبت کاربر ناموفق بود');
      } catch {
        setError('ثبت کاربر ناموفق بود');
      }
    }
  };

  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm">ایمیل</label>
          <input
            dir="ltr"
            inputMode="email"
            autoComplete="email"
            className="w-full rounded-md border px-3 py-2"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="user@example.com"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm">نام</label>
          <input
            className="w-full rounded-md border px-3 py-2"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="نام و نام خانوادگی"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm">رمز عبور</label>
          <input
            type="password"
            autoComplete="new-password"
            className="w-full rounded-md border px-3 py-2"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="حداقل ۶ کاراکتر"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm">تأیید رمز عبور</label>
          <input
            type="password"
            autoComplete="new-password"
            className="w-full rounded-md border px-3 py-2"
            value={passwordConfirm}
            onChange={e => setPasswordConfirm(e.target.value)}
            placeholder="تکرار رمز عبور"
            required
          />
        </div>
      </div>

      {pwMismatch && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 border border-red-200">
          رمز عبور و تأیید آن یکسان نیست
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 border border-red-200">
          {error}
        </div>
      )}

      <div>
        <div className="mb-2 text-sm text-gray-600">انتخاب گروه‌ها</div>
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

      <div className="sm:col-span-2">
        <button
          disabled={!canSubmit}
          className="w-full rounded-md bg-gray-900 text-white py-2 disabled:opacity-50"
        >
          {saving ? 'در حال ایجاد…' : 'ایجاد کاربر'}
        </button>
      </div>
    </form>
  );
}
