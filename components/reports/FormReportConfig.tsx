'use client';
import { useMemo } from 'react';

export type ReportConfig = {
  visibleColumns: string[];
  filterableKeys: string[];
  orderableKeys:  string[];
  defaultOrder:   { key: string; dir: 'asc'|'desc' };
};

export default function FormReportConfig({
  fields,
  value,
  onChange,
}: {
  fields: { key:string; labelFa:string; type:string }[];
  value: ReportConfig;
  onChange: (next: ReportConfig)=>void;
}) {
  // convenience toggler
  const toggle = (arr: string[], key: string) =>
    arr.includes(key) ? arr.filter(k => k !== key) : [...arr, key];

  const setVisible   = (key: string) => onChange({ ...value, visibleColumns: toggle(value.visibleColumns, key) });
  const setFilter    = (key: string) => onChange({ ...value, filterableKeys: toggle(value.filterableKeys, key) });
  const setOrderable = (key: string) => onChange({ ...value, orderableKeys:  toggle(value.orderableKeys,  key) });

  const keyToLabel = useMemo(() => {
    const m: Record<string, string> = { createdAt: 'تاریخ ایجاد' };
    for (const f of fields) m[f.key] = f.labelFa || f.key;
    return m;
}, [fields]);

const orderCandidates = useMemo(
  () => ['createdAt', ...fields.map((f) => f.key)],
  [fields]
);

  return (
    <div className="rounded-xl border bg-white p-4 space-y-3">
      <h2 className="font-semibold">تنظیمات گزارش فرم</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <div className="text-sm font-medium mb-2">ستون‌های قابل نمایش</div>
          <div className="space-y-2">
            {fields.map(f => (
              <label key={f.key} className="flex items-center gap-2">
                <input type="checkbox"
                  checked={value.visibleColumns.includes(f.key)}
                  onChange={()=>setVisible(f.key)}
                />
                <span>{f.labelFa} ({f.key})</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <div className="text-sm font-medium mb-2">فیلترپذیر</div>
          <div className="space-y-2">
            {fields.map(f => (
              <label key={f.key} className="flex items-center gap-2">
                <input type="checkbox"
                  checked={value.filterableKeys.includes(f.key)}
                  onChange={()=>setFilter(f.key)}
                />
                <span>{f.labelFa} ({f.key})</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <div>
            <div className="text-sm font-medium mb-2">مرتب‌سازی</div>
            <div className="space-y-2">
                {orderCandidates.map((k) => (
                <label key={k} className="flex items-center gap-2">
                    <input
                    type="checkbox"
                    checked={value.orderableKeys.includes(k)}
                    onChange={() => setOrderable(k)} // your existing toggle handler
                    />
                    <span>{keyToLabel[k]}</span>
                </label>
                ))}
            </div>
        </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <select
              className="rounded-md border px-2 py-1"
              value={value.defaultOrder.key}
              onChange={e=>onChange({ ...value, defaultOrder: { ...value.defaultOrder, key: e.target.value } })}
            >
              {['createdAt', ...fields.map(f=>f.key)].map(k => (
                <option key={k} value={k}> {keyToLabel[k]}</option>
              ))}
            </select>
            <select
              className="rounded-md border px-2 py-1"
              value={value.defaultOrder.dir}
              onChange={e=>onChange({ ...value, defaultOrder: { ...value.defaultOrder, dir: e.target.value as 'asc'|'desc' } })}
            >
              <option value="asc">صعودی</option>
              <option value="desc">نزولی</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
