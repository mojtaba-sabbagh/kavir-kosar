'use client';

import { useEffect, useMemo, useState } from 'react';

type Role = { id: string; name: string };
type Form = { id: string; code: string; titleFa: string };
type Perm = {
  id: string; roleId: string; formId: string;
  canRead: boolean; canSubmit: boolean; canConfirm: boolean; canFinalConfirm: boolean;
};

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
    for (const r of roles) {
      for (const f of forms) {
        map[`${r.id}:${f.id}`] = { canRead: false, canSubmit: false, canConfirm: false, canFinalConfirm: false };
      }
    }
    for (const p of perms) {
      map[`${p.roleId}:${p.formId}`] = {
        canRead: !!p.canRead,
        canSubmit: !!p.canSubmit,
        canConfirm: !!p.canConfirm,
        canFinalConfirm: !!p.canFinalConfirm,
      };
    }
    return map;
  }, [roles, forms, perms]);

  const [matrix, setMatrix] = useState<Record<string, Cell>>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<null | boolean>(null);

  // If props change (e.g., after server refresh), sync state
  useEffect(() => setMatrix(initial), [initial]);

const onToggle = (
  roleId: string,
  formId: string,
  field: 'canRead' | 'canSubmit' | 'canConfirm' | 'canFinalConfirm'
) => {
  const key = `${roleId}:${formId}`;
  setSaved(null);
  setMatrix(prev => {
    const cur: Cell = prev[key] ?? { canRead:false, canSubmit:false, canConfirm:false, canFinalConfirm:false };
    const next: Cell = { ...cur };

    if (field === 'canFinalConfirm') {
      const newVal = !cur.canFinalConfirm;
      next.canFinalConfirm = newVal;
      if (newVal) {
        next.canConfirm = false; // mutually exclusive
        next.canRead = true;
      }
      // enforce single final per form in UI: clear others' final
      if (newVal) {
        const draft = { ...prev, [key]: next };
        for (const r of roles) {
          const otherKey = `${r.id}:${formId}`;
          if (otherKey !== key && draft[otherKey]?.canFinalConfirm) {
            draft[otherKey] = { ...draft[otherKey], canFinalConfirm: false };
          }
        }
        return draft;
      }
    } else if (field === 'canConfirm') {
      const newVal = !cur.canConfirm;
      next.canConfirm = newVal;
      if (newVal) {
        next.canFinalConfirm = false; // mutually exclusive
        next.canRead = true;
      }
    } else if (field === 'canSubmit') {
      next.canSubmit = !cur.canSubmit;
      if (next.canSubmit) next.canRead = true;
    } else if (field === 'canRead') {
      next.canRead = !cur.canRead;
      if (!next.canRead) {
        next.canSubmit = false;
        next.canConfirm = false;
        next.canFinalConfirm = false;
      }
    }

    return { ...prev, [key]: next };
  });
};

  const save = async () => {
    setSaving(true);
    setSaved(null);

    // Normalize before sending (server will also normalize)
    const normalized: Record<string, Cell> = {};
    for (const [k, v] of Object.entries(matrix)) {
      const read = v.canFinalConfirm || v.canConfirm || v.canSubmit || v.canRead;
      normalized[k] = {
        canRead: !!read,
        canSubmit: read ? !!v.canSubmit : false,
        canConfirm: read ? !!(v.canFinalConfirm || v.canConfirm) : false,
        canFinalConfirm: read ? !!v.canFinalConfirm : false,
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
      try {
        const j = await res.json();
        console.error('Save error:', j);
        alert(j?.message || 'ذخیره مجوزها ناموفق بود');
      } catch {
        alert('ذخیره مجوزها ناموفق بود');
      }
    }
  };

  return (
<div className="relative" dir="rtl">
  {/* Sticky Save Button (unchanged) */}
  <div className="sticky right-0 top-0 z-20 bg-white border-b border-gray-200 p-4 shadow-sm">
    <div className="flex items-center gap-3">
      <button
        onClick={save}
        disabled={saving}
        className="rounded-md bg-gray-900 text-white px-4 py-2 disabled:opacity-50 hover:bg-gray-800 transition-colors"
      >
        {saving ? 'در حال ذخیره…' : 'ذخیره'}
      </button>
      {saved === true && <span className="text-green-600 text-xs">ذخیره شد</span>}
      {saved === false && <span className="text-red-600 text-xs">خطا در ذخیره</span>}
    </div>
  </div>

  {/* Table Container */}
  <div className="overflow-x-auto relative">
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="text-center text-gray-500 bg-gray-50">
          {/* Sticky Header Cell with RGBA Transparency */}
          <th
            className="sticky top-0 right-0 z-10 p-3 w-40 border-b border-gray-200 text-right font-semibold"
            style={{ backgroundColor: 'rgba(249, 250, 251, 0.8)' }} // Gray-50 with 80% opacity
          >
            فرم / نقش
          </th>
          {roles.map(r => (
            <th key={r.id} className="p-3 whitespace-nowrap border-b border-gray-200 border-r min-w-[300px]">
              <div className="font-semibold text-gray-700">{r.name}</div>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {forms.map((f, index) => (
          <tr key={f.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-blue-50/30 transition-colors`}>
            {/* Sticky Cell with RGBA Transparency */}
            <td
              className={`sticky right-0 z-10 p-3 font-medium whitespace-nowrap border-b border-gray-100 shadow-sm`}
              style={{
                backgroundColor: index % 2 === 0 ? 'rgba(255, 255, 255, 0.95)' : 'rgba(249, 250, 251, 0.9)', // White or Gray-50/50 with transparency
              }}
            >
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span className="text-gray-800">{f.titleFa}</span>
                <div className="text-xs text-gray-500 mt-1">کد: {f.code}</div>
              </div>
            </td>
            {roles.map(r => {
              const k = `${r.id}:${f.id}`;
              const v = matrix[k] ?? { canRead: false, canSubmit: false, canConfirm: false, canFinalConfirm: false };
              return (
                <td key={k} className="p-3 border-r border-b border-gray-100">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="inline-flex items-center gap-2 p-2 rounded-md hover:bg-gray-100 transition-colors cursor-pointer">
                      <input
                        type="checkbox"
                        checked={v.canRead}
                        onChange={() => onToggle(r.id, f.id, 'canRead')}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">مشاهده</span>
                    </label>

                    <label className="inline-flex items-center gap-2 p-2 rounded-md hover:bg-gray-100 transition-colors cursor-pointer">
                      <input
                        type="checkbox"
                        checked={v.canSubmit}
                        onChange={() => onToggle(r.id, f.id, 'canSubmit')}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <span className="text-sm text-gray-700">ارسال</span>
                    </label>

                    <label className="inline-flex items-center gap-2 p-2 rounded-md hover:bg-gray-100 transition-colors cursor-pointer">
                      <input
                        type="checkbox"
                        checked={v.canConfirm}
                        onChange={() => onToggle(r.id, f.id, 'canConfirm')}
                        className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                      />
                      <span className="text-sm text-gray-700">تأیید کننده</span>
                    </label>

                    <label className="inline-flex items-center gap-2 p-2 rounded-md hover:bg-gray-100 transition-colors cursor-pointer">
                      <input
                        type="checkbox"
                        checked={v.canFinalConfirm}
                        onChange={() => onToggle(r.id, f.id, 'canFinalConfirm')}
                        className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                      />
                      <span className="text-sm text-gray-700">تأیید کننده نهایی</span>
                    </label>
                  </div>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</div>
    );
}