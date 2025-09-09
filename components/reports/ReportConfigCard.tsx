'use client';
import { useEffect, useMemo, useState } from 'react';

export default function ReportConfigCard({
  formId,
  fields,
}: {
  formId: string;
  fields: { key: string; labelFa: string; type: string }[];
}) {
  const [visible, setVisible] = useState<string[]>([]);
  const [filterable, setFilter] = useState<string[]>([]);
  const [orderable, setOrder] = useState<string[]>([]);
  const [orderKey, setOrderKey] = useState<string>('createdAt');
  const [orderDir, setOrderDir] = useState<'asc' | 'desc'>('desc');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Map: key -> Persian label
  const keyToLabel = useMemo(() => {
    const m: Record<string, string> = { createdAt: 'تاریخ ایجاد' };
    for (const f of fields) m[f.key] = f.labelFa || f.key;
    return m;
  }, [fields]);

  // All “orderable candidates”: createdAt + all fields’ keys
  const orderCandidates = useMemo(
    () => ['createdAt', ...fields.map((f) => f.key)],
    [fields]
  );

  // Load existing
  useEffect(() => {
    (async () => {
      const r = await fetch(`/api/reports/form/${formId}/schema`, {
        cache: 'no-store',
      });
      if (!r.ok) return;
      const j = await r.json();
      if (!j?.config) return;

      setVisible(j.config.visibleColumns ?? []);
      setFilter(j.config.filterableKeys ?? []);
      setOrder(j.config.orderableKeys ?? []);

      const def = j.config.defaultOrder ?? {};
      if (def.key) setOrderKey(def.key);
      if (def.dir) setOrderDir(def.dir);
    })();
  }, [formId]);

  // Helpers
  const toggle = (arr: string[], setArr: (v: string[]) => void, key: string) => {
    setArr(arr.includes(key) ? arr.filter((k) => k !== key) : [...arr, key]);
  };

  const saveReport = async () => {
    setSaving(true);
    setMsg(null);
    const res = await fetch(`/api/admin/forms/${formId}/report-config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visibleColumns: visible,
        filterableKeys: filterable,
        orderableKeys: orderable,
        defaultOrder: { key: orderKey, dir: orderDir },
      }),
    });
    setSaving(false);
    setMsg(res.ok ? 'ذخیره شد' : 'خطا در ذخیره');
  };

  return (
    <div className="rounded-xl border bg-white p-4 space-y-3">
      <h2 className="font-semibold">تنظیمات گزارش فرم</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Visible columns */}
        <div>
          <div className="text-sm font-medium mb-2">ستون‌های قابل نمایش</div>
          <div className="space-y-2">
            {fields.map((f) => (
              <label key={f.key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={visible.includes(f.key)}
                  onChange={() => toggle(visible, setVisible, f.key)}
                />
                <span>{f.labelFa} ({f.key})</span>
              </label>
            ))}
          </div>
        </div>

        {/* Filterable keys */}
        <div>
          <div className="text-sm font-medium mb-2">فیلترپذیر</div>
          <div className="space-y-2">
            {fields.map((f) => (
              <label key={f.key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filterable.includes(f.key)}
                  onChange={() => toggle(filterable, setFilter, f.key)}
                />
                <span>{f.labelFa} ({f.key})</span>
              </label>
            ))}
          </div>
        </div>

        {/* Orderable + default order */}
        <div>
          <div className="text-sm font-medium mb-2">مرتب‌سازی</div>
          <div className="space-y-2">
            {orderCandidates.map((k) => (
              <label key={k} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={orderable.includes(k)}
                  onChange={() => toggle(orderable, setOrder, k)}
                />
                <span>{keyToLabel[k] ?? k}</span>
              </label>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <select
              className="rounded-md border px-2 py-1"
              value={orderKey}
              onChange={(e) => setOrderKey(e.target.value)}
            >
              {orderCandidates.map((k) => (
                <option key={k} value={k}>
                  {keyToLabel[k] ?? k}
                </option>
              ))}
            </select>
            <select
              className="rounded-md border px-2 py-1"
              value={orderDir}
              onChange={(e) => setOrderDir(e.target.value as any)}
            >
              <option value="asc">صعودی</option>
              <option value="desc">نزولی</option>
            </select>
          </div>
        </div>
      </div>

      <div className="pt-2">
        <button
          onClick={saveReport}
          disabled={saving}
          className="rounded-md bg-blue-600 text-white px-4 py-2 disabled:opacity-50"
        >
          {saving ? 'در حال ذخیره…' : 'ذخیره تنظیمات گزارش'}
        </button>
        {msg && <span className="ml-3 text-sm">{msg}</span>}
      </div>
    </div>
  );
}
