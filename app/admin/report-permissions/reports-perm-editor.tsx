'use client';

import { useMemo, useState } from 'react';
type Role = { id: string; name: string };
type Report = { id: string; code: string; titleFa: string };
type Perm = { id: string; roleId: string; reportId: string; canView: boolean };

export default function ReportsPermEditor({ roles, reports, perms }:{
  roles: Role[]; reports: Report[]; perms: Perm[];
}) {
  const initial = useMemo(() => {
    const m: Record<string, boolean> = {};
    for (const r of roles) for (const f of reports) m[`${r.id}:${f.id}`] = false;
    for (const p of perms) m[`${p.roleId}:${p.reportId}`] = !!p.canView;
    return m;
  }, [roles, reports, perms]);

  const [matrix, setMatrix] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState<null|boolean>(null);

  const toggle = (roleId: string, reportId: string) => {
    const k = `${roleId}:${reportId}`;
    setOk(null);
    setMatrix(prev => ({ ...prev, [k]: !prev[k] }));
  };

  const save = async () => {
    setSaving(true); setOk(null);
    const res = await fetch('/api/admin/report-permissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matrix }), // { "roleId:reportId": true/false }
    });
    setSaving(false);
    setOk(res.ok);
    if (!res.ok) alert('ذخیره مجوزها ناموفق بود');
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-right text-gray-500">
            <th className="py-2 w-40">نقش \\ گزارش</th>
            {reports.map(r => <th key={r.id} className="py-2 whitespace-nowrap">{r.titleFa}</th>)}
          </tr>
        </thead>
        <tbody>
          {roles.map(role => (
            <tr key={role.id} className="border-t">
              <td className="py-2 font-medium">{role.name}</td>
              {reports.map(rep => {
                const k = `${role.id}:${rep.id}`;
                return (
                  <td key={k} className="py-2 text-center">
                    <label className="inline-flex items-center gap-2">
                      <input type="checkbox" checked={!!matrix[k]} onChange={() => toggle(role.id, rep.id)} />
                      <span>دسترسی</span>
                    </label>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex items-center gap-3">
        <button onClick={save} disabled={saving} className="rounded-md bg-gray-900 text-white px-4 py-2 disabled:opacity-50">
          {saving ? 'در حال ذخیره…' : 'ذخیره'}
        </button>
        {ok === true && <span className="text-green-600 text-xs">ذخیره شد</span>}
        {ok === false && <span className="text-red-600 text-xs">خطا در ذخیره</span>}
      </div>
    </div>
  );
}
