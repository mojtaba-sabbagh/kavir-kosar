'use client';

import { useState, useMemo } from 'react';

type Role = { id: string; name: string };
type Form = { id: string; code: string; titleFa: string };
type Perm = { id: string; roleId: string; formId: string; canRead: boolean; canSubmit: boolean; canConfirm: boolean; canFinalConfirm: boolean };

type Cell = { canRead: boolean; canSubmit: boolean; canConfirm: boolean; canFinalConfirm: boolean };

export default function PermissionsEditor({
  roles,
  forms,
  perms,
}: {
  roles: Role[];
  forms: Form[];
  perms: Perm[];
}) {
  // Build initial matrix: key = `${roleId}:${formId}`
  const initial = useMemo(() => {
    const map: Record<string, Cell> = {};
    for (const r of roles) for (const f of forms) map[`${r.id}:${f.id}`] = { canRead: false, canSubmit: false, canConfirm: false, canFinalConfirm: false };
    for (const p of perms) map[`${p.roleId}:${p.formId}`] = { canRead: !!p.canRead, canSubmit: !!p.canSubmit,
                                                              canConfirm: !!p.canConfirm, canFinalConfirm: !!p.canFinalConfirm, };
    return map;
  }, [roles, forms, perms]);

  const [matrix, setMatrix] = useState<Record<string, Cell>>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<null | boolean>(null);

  const onToggle = (roleId: string, formId: string, field: 'canRead' | 'canSubmit') => {
    const key = `${roleId}:${formId}`;
    setSaved(null);
    setMatrix(prev => {
      const cur = prev[key] || { canRead: false, canSubmit: false };
      const next: Cell = { ...cur };

      // toggle handler
    if (field === 'canFinalConfirm') {
      next.canFinalConfirm = !cur.canFinalConfirm;
      if (next.canFinalConfirm) { next.canConfirm = true; next.canRead = true; }
    } else if (field === 'canConfirm') {
      next.canConfirm = !cur.canConfirm;
      if (next.canConfirm) { next.canRead = true; }
      else { next.canFinalConfirm = false; }
    } else if (field === 'canRead') {
      next.canRead = !cur.canRead;
      if (!next.canRead) { next.canSubmit = false; next.canConfirm = false; next.canFinalConfirm = false; }
    } else if (field === 'canSubmit') {
      next.canSubmit = !cur.canSubmit;
      if (next.canSubmit) next.canRead = true;
    }
      return { ...prev, [key]: next };
    });
  };

  const save = async () => {
    setSaving(true); setSaved(null);
    // Normalize before sending (extra safety on client)
    const normalized: Record<string, Cell> = {};
    for (const [k, v] of Object.entries(matrix)) {
      normalized[k] = {
        canRead: v.canSubmit ? true : !!v.canRead,
        canSubmit: v.canRead ? !!v.canSubmit : false,
      };
    }

    const res = await fetch('/api/admin/permissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matrix: normalized }),
    });
    setSaving(false);
    setSaved(res.ok);
    if (!res.ok) {
      try { console.error(await res.json()); } catch {}
      alert('ذخیره مجوزها ناموفق بود');
    }
  };

  return (
   <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-center text-gray-500">
            <th className="p-2 w-40">نقش // فرم</th>
            {forms.map(f => (
              <th key={f.id} className="p-2 whitespace-nowrap border-r border-gray-300">{f.titleFa}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {roles.map(r => (
            <tr key={r.id} className="border-t">
              <td className="p-2 font-medium">{r.name}</td>
              {forms.map(f => {
                const k = `${r.id}:${f.id}`;
                const v = matrix[k] || { canRead: false, canSubmit: false };
                return (
                  <td key={k} className="p-2 border-r border-gray-300">
                    <div className="flex items-center gap-4">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={v.canRead}
                          onChange={() => onToggle(r.id, f.id, 'canRead')}
                        />
                        <span>مشاهده</span>
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={v.canSubmit}
                          onChange={() => onToggle(r.id, f.id, 'canSubmit')}
                        />
                        <span>ارسال</span>
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input type="checkbox" checked={v.canConfirm} onChange={() => onToggle(r.id, f.id, 'canConfirm')} />
                        <span>تأیید کننده</span>
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input type="checkbox" checked={v.canFinalConfirm} onChange={() => onToggle(r.id, f.id, 'canFinalConfirm')} />
                        <span>تأیید کننده نهایی</span>
                      </label>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-md bg-gray-900 text-white px-4 py-2 disabled:opacity-50"
        >
          {saving ? 'در حال ذخیره…' : 'ذخیره'}
        </button>
        {saved === true && <span className="text-green-600 text-xs">ذخیره شد</span>}
        {saved === false && <span className="text-red-600 text-xs">خطا در ذخیره</span>}
      </div>
    </div>
  );
}
