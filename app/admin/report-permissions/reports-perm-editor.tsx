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
    <div className="relative" dir="rtl">
      {/* Sticky Save Button */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="rounded-md bg-gray-900 text-white px-4 py-2 disabled:opacity-50 hover:bg-gray-800 transition-colors"
          >
            {saving ? 'در حال ذخیره…' : 'ذخیره'}
          </button>
          {ok === true && <span className="text-green-600 text-xs">ذخیره شد</span>}
          {ok === false && <span className="text-red-600 text-xs">خطا در ذخیره</span>}
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto relative">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-center text-gray-500 bg-gray-50">
              {/* Sticky Header Cell for Report Column */}
              <th className="sticky top-0 right-0 z-10 p-2 w-40 bg-gray-50 border-b border-gray-200 text-right font-semibold">
                گزارش / نقش
              </th>
              {roles.map(r => (
                <th key={r.id} className="p-2 whitespace-nowrap border-b border-gray-200 border-r min-w-[150px]">
                  <div className="font-semibold text-gray-700">{r.name}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reports.map((rep, index) => (
              <tr key={rep.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-blue-50/30 transition-colors border-t`}>
                {/* Sticky Cell for Report Title */}
                <td
                  className={`sticky right-0 z-10 p-2 font-medium whitespace-nowrap border-b border-gray-100 shadow-sm`}
                  style={{
                      backgroundColor: index % 2 === 0 ? 'rgba(255, 255, 255, 0.95)' : 'rgba(249, 250, 251, 0.9)', // White or Gray-50/50 with transparency
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gray-800">{rep.titleFa}</span>
                  </div>
                </td>
                {roles.map(role => {
                  const k = `${role.id}:${rep.id}`;
                  return (
                    <td key={k} className="p-2 text-center border-r border-b border-gray-100">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!!matrix[k]}
                          onChange={() => toggle(role.id, rep.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">دسترسی</span>
                      </label>
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
