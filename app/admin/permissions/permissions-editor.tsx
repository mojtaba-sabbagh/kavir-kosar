'use client';

import { useMemo, useState } from 'react';

type Role = { id: string; name: string };
type Form = { id: string; code: string; titleFa: string };
type Perm = { id: string; roleId: string; formId: string; canRead: boolean; canSubmit: boolean };

export default function PermissionsEditor({
  roles,
  forms,
  perms,
}: {
  roles: Role[];
  forms: Form[];
  perms: Perm[];
}) {
  const [local, setLocal] = useState<Record<string, { canRead: boolean; canSubmit: boolean }>>(() => {
    const map: Record<string, { canRead: boolean; canSubmit: boolean }> = {};
    perms.forEach((p) => {
      map[`${p.roleId}:${p.formId}`] = { canRead: p.canRead, canSubmit: p.canSubmit };
    });
    return map;
  });

  const toggle = (roleId: string, formId: string, key: 'canRead' | 'canSubmit') => {
    const k = `${roleId}:${formId}`;
    setLocal((prev) => ({
      ...prev,
      [k]: {
        canRead: prev[k]?.canRead ?? false,
        canSubmit: prev[k]?.canSubmit ?? false,
        [key]: !(prev[k]?.[key] ?? false),
      },
    }));
  };

  const minWidthPx = useMemo(() => {
    // ~220px per form col + ~220px for the first sticky column
    return Math.max(880, 220 * (forms.length + 1));
  }, [forms.length]);

  const save = async () => {
    const res = await fetch('/api/admin/permissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matrix: local }),
    });
    if (res.ok) location.reload();
    else alert('ذخیره مجوزها ناموفق بود');
  };

  return (
    <div className="p-4">
      <div
        className="inline-block align-top"
        style={{ minWidth: `${minWidthPx}px` }} // widen based on column count
      >
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead>
            <tr className="bg-gray-50">
              {/* Sticky first header cell */}
              <th
                className="sticky right-0 z-20 bg-gray-50 border-b px-4 py-3 text-right"
                style={{ minWidth: 140 }}
              >
                نقش / فرم
              </th>
              {forms.map((f) => (
                <th key={f.id} className="border-b px-4 py-3 whitespace-nowrap text-right">
                  <div className="font-medium">{f.titleFa}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">{f.code}</div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {roles.map((r) => (
              <tr key={r.id} className="odd:bg-white even:bg-gray-50">
                {/* Sticky first column */}
                <td
                  className="sticky right-0 z-10 bg-inherit border-t px-4 py-3 font-medium whitespace-nowrap"
                  style={{ minWidth: 140}}
                >
                  {r.name}
                </td>

                {forms.map((f) => {
                  const k = `${r.id}:${f.id}`;
                  const v = local[k] || { canRead: false, canSubmit: false };
                  return (
                    <td key={k} className="border-t px-4 py-2">
                      <div className="flex items-center gap-4 whitespace-nowrap">
                        <label className="inline-flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={!!v.canRead}
                            onChange={() => toggle(r.id, f.id, 'canRead')}
                          />
                          <span>خواندن</span>
                        </label>
                        <label className="inline-flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={!!v.canSubmit}
                            onChange={() => toggle(r.id, f.id, 'canSubmit')}
                          />
                          <span>ارسال</span>
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

      <div className="mt-4">
        <button onClick={save} className="rounded-md bg-gray-900 text-white px-4 py-2">
          ذخیره
        </button>
      </div>
    </div>
  );
}
