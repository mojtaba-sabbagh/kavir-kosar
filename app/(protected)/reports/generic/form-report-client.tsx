'use client';

// guard so we only initialize order once from server meta
import { useEffect, useMemo, useRef, useState } from 'react';
import JDateRangeFilter from '@/components/ui/JDateRangeFilter';
import JDateTimeRangeFilter from '@/components/ui/JDateTimeRangeFilter';

type Meta = {
  formCode: string;
  titleFa: string;
  page: number;
  pageSize: number;
  total: number;
  visibleColumns?: string[];
  filterableKeys?: string[];
  orderableKeys?: string[];
  defaultOrder?: { key?: string; dir?: 'asc' | 'desc' } | null;
};
type Row = { id: string; createdAt: string; status: string; payload: Record<string, any> };
type SchemaField = { key: string; type: string; config?: any };

export default function FormReportClient({ code }: { code: string }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [displayMaps, setDisplayMaps] = useState<Record<string, Record<string, string>>>({});
  const [schema, setSchema] = useState<SchemaField[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // order state (initialize with sensible defaults; update from meta when it arrives)
  const [orderKey, setOrderKey] = useState<string>('createdAt');
  const [orderDir, setOrderDir] = useState<'asc'|'desc'>('desc');
  
  // filters: key -> string | {from?: string; to?: string}
  type Filters = Record<string, any>;
  const [filters, setFilters] = useState<Filters>({});

  // guard so we only initialize order once from server meta
  const didInitOrder = useRef(false);

  
  
// build qs stays the same (depends on orderKey/orderDir)
const qs = useMemo(() => {
  const p = new URLSearchParams();

  // order & paging
  p.set('order', orderKey || 'createdAt');
  p.set('dir', orderDir || 'desc');
  p.set('page', '1');
  p.set('pageSize', '20');

  // determine which keys to serialize:
  // prefer filterableKeys from server; fallback to whatever user edited (filters keys)
  const allowed = new Set([
    ...(meta?.filterableKeys ?? []),
    ...Object.keys(filters ?? {})
  ]);

  for (const k of allowed) {
    const t = schema.find(s => s.key === k)?.type || 'text';
    const v = (filters as any)?.[k];

    if (t === 'date' || t === 'datetime') {
      if (v?.from) p.set(`filter_${k}_from`, v.from);
      if (v?.to)   p.set(`filter_${k}_to`,   v.to);
    } else {
      if (v != null && v !== '') p.set(`filter_${k}`, String(v));
    }
  }

  return `?${p.toString()}`;
}, [orderKey, orderDir, filters, meta?.filterableKeys, schema]);

  // Fetch data
useEffect(() => {
  let cancel = false;
  (async () => {
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`/api/reports/${encodeURIComponent(code)}/entries${qs}`, { cache: 'no-store' });
      const j = await res.json();

      if (!cancel) {
        setMeta(j.meta);
        setLabels(j.labels || {});
        setRows(Array.isArray(j.rows) ? j.rows : []);
        setDisplayMaps(j.displayMaps && typeof j.displayMaps === 'object' ? j.displayMaps : {});
        setSchema(Array.isArray(j.schema) ? j.schema : []);  // 👈 important


        // Initialize order ONLY ONCE from server-provided defaults
        if (!didInitOrder.current) {
          const initialKey = j.meta?.orderApplied || j.meta?.defaultOrder?.key || 'createdAt';
          const initialDir = j.meta?.defaultOrder?.dir || 'desc';
          setOrderKey(initialKey);
          setOrderDir(initialDir);
          didInitOrder.current = true;
        }
      }
    } catch (e: any) {
      if (!cancel) setErr(e?.message || 'خطا');
    } finally {
      if (!cancel) setLoading(false);
    }
  })();
  return () => { cancel = true; };
}, [code, qs]);

  const schemaArr = Array.isArray(schema) ? schema : [];   // 👈 normalize once
  // Build map key->type
  const typeByKey = useMemo(() => {
  const m: Record<string, string> = {};
  schemaArr.forEach(f => { m[f.key] = f.type; });
  return m;
}, [schemaArr]);

const visible = useMemo(() => {
  if (meta?.visibleColumns?.length) return meta.visibleColumns;
  if (schemaArr.length) return schemaArr.map(f => f.key);
  if (rows[0]?.payload) return Object.keys(rows[0].payload);
  return [];
}, [meta, schemaArr, rows]);

  // Format persian date
  function formatJalali(dateLike: string | number | Date, withTime = false) {
    try {
      const d = new Date(dateLike);
      const opts: Intl.DateTimeFormatOptions = withTime
        ? { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }
        : { year: 'numeric', month: '2-digit', day: '2-digit' };
      return new Intl.DateTimeFormat('fa-IR-u-ca-persian', opts).format(d);
    } catch {
      return String(dateLike ?? '');
    }
  }

  // Render cell by type + map
  function renderCell(key: string, value: any) {
    const t = typeByKey[key];

    // date/datetime
    if (t === 'date' && value) return formatJalali(value, false);
    if (t === 'datetime' && value) return formatJalali(value, true);

    // select/multiselect/kardexItem label maps
    const map = displayMaps?.[key];
    if (Array.isArray(value)) {
      return value.map((v, i) => (
        <span key={i} className="inline-block mx-0.5">
          {map?.[String(v)] ?? String(v)}
        </span>
      ));
    }
    if (value == null) return '';
    return map?.[String(value)] ?? String(value);
  }

  return (
    <div className="space-y-4">
      {err && <div className="text-red-600 text-sm">{err}</div>}

      {/* Controls */}
      <div className="rounded-xl border bg-white p-3 space-y-3">
        {/* Filters */}
        {meta?.filterableKeys?.length ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3" dir="rtl">
            {meta.filterableKeys.map((k) => {
              const label = labels[k] || k;
              const field = schema.find(s => s.key === k);
              const t = field?.type || 'text';
              const v = filters[k];

              // --- tableSelect: select populated by configured table/type ---
              if (t === 'tableSelect' && field?.config?.tableSelect?.type && field?.config?.tableSelect) {
                const ts = field.config.tableSelect;
                return (
                  <TableSelectFilter
                    key={k}
                    label={label}
                    table={ts.table ?? 'fixedInformation'} // default if you always use FixedInformation
                    type={ts.type}
                    value={typeof v === 'string' ? v : ''}
                    onChange={(code) => setFilters(prev => ({ ...prev, [k]: code }))}
                  />
                );
              }

              // --- date / datetime: range pickers (your JDate/JDateTime components if used) ---
              if (t === 'date') {
                return (
                  <div key={k} className="space-y-1 overflow-visible">
                    <div className="text-xs text-gray-600">{label}</div>
                    <JDateRangeFilter
                      value={v || {}}
                      onChange={(nv) => setFilters(prev => ({ ...prev, [k]: nv }))}
                    />
                  </div>
                );
              }

              if (t === 'datetime') {
                return (
                  <div key={k} className="space-y-1 overflow-visible">
                    <div className="text-xs text-gray-600">{label}</div>
                    <JDateTimeRangeFilter
                      value={v || {}}
                      onChange={(nv) => setFilters(prev => ({ ...prev, [k]: nv }))}
                    />
                  </div>
                );
              }
              // --- default text filter ---
              return (
                <div key={k} className="space-y-1">
                  <label className="text-xs text-gray-600 block">{label}</label>
                  <input
                    className="w-full border rounded-md px-2 py-1"
                    dir="rtl"
                    value={v || ''}
                    onChange={e => setFilters(prev => ({ ...prev, [k]: e.target.value }))}
                    placeholder={`جستجو در ${label}…`}
                  />
                </div>
              );
            })}
          </div>
        ) : null}


        {/* Ordering */}
        <div className="flex flex-wrap items-center gap-3" dir="rtl">
          <div className="text-xs text-gray-600">مرتب‌سازی:</div>
          <select
            className="border rounded-md px-2 py-1"
            value={orderKey}
            onChange={e => setOrderKey(e.target.value)}
          >
            {(meta?.orderableKeys ?? ['createdAt']).map(k => (
              <option key={k} value={k}>
                {labels[k] || (k === 'createdAt' ? 'تاریخ ایجاد' : k)}
              </option>
            ))}
          </select>
          <select
            className="border rounded-md px-2 py-1"
            value={orderDir}
            onChange={e => setOrderDir(e.target.value as 'asc' | 'desc')}
          >
            <option value="asc">صعودی</option>
            <option value="desc">نزولی</option>
          </select>

          <div className="ms-auto flex items-center gap-2">
            <button
              type="button"
              className="rounded-md border px-3 py-1 hover:bg-gray-50"
              onClick={() => setFilters({})}
            >
              حذف فیلترها
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-white overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="p-2 text-right whitespace-nowrap">#</th>
              <th className="p-2 text-right whitespace-nowrap">تاریخ ایجاد</th>
              {visible.map((k) => (
                <th key={k} className="p-2 text-right whitespace-nowrap">
                  {labels[k] || k}
                </th>
              ))}
              <th className="p-2 text-right whitespace-nowrap">وضعیت</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className="border-t">
                <td className="p-2 whitespace-nowrap">
                  {(meta!.page - 1) * meta!.pageSize + i + 1}
                </td>
                <td className="p-2 whitespace-nowrap ltr">
                  {formatJalali(r.createdAt, true)}
                </td>
                {visible.map((k) => (
                  <td key={k} className="px-3 py-2">
                    {renderCell(k, r.payload?.[k])}
                  </td>
                ))}
                <td className="p-2 whitespace-nowrap">{statusFa(r.status)}</td>
              </tr>
            ))}

            {(!rows || rows.length === 0) && (
              <tr>
                <td className="p-4 text-center text-gray-500" colSpan={(visible?.length ?? 0) + 3}>
                  {loading ? 'در حال بارگذاری…' : 'داده‌ای یافت نشد'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function statusFa(s: string) {
  switch (s) {
    case 'submitted':
      return 'ارسال شده';
    case 'firstConfirmed':
      return 'تأیید نخست';
    case 'finalConfirmed':
      return 'تأیید نهایی';
    default:
      return s;
  }
}

// inside form-report-client.tsx (same file)

function TableSelectFilter({
  label,
  table,
  type,
  value,
  onChange,
}: {
  label: string;
  table: string;
  type: string;
  value?: string;
  onChange: (v: string) => void;
}) {
  const [opts, setOpts] = useState<{code:string; title:string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string|null>(null);

  useEffect(() => {
  let cancel = false;
  (async () => {
    setLoading(true); setErr(null);
    try {
      const url = `/api/table-select?table=${encodeURIComponent(table)}&type=${encodeURIComponent(type)}&limit=200`;
      const r = await fetch(url, { cache: 'no-store' });
      const j = await r.json();

      // Accept either: { items: [{code,title}] } OR { options: [{value,label}] }
      const raw = Array.isArray(j?.items) ? j.items
               : Array.isArray(j?.options) ? j.options
               : [];

      const normalized = raw.map((it: any) => ({
        code:  it.code  ?? it.value ?? '',
        title: it.title ?? it.label ?? '',
      })).filter(x => x.code && x.title);

      if (!cancel) setOpts(normalized);
    } catch (e:any) {
      if (!cancel) setErr(e?.message || 'خطا در بارگذاری گزینه‌ها');
    } finally {
      if (!cancel) setLoading(false);
    }
  })();
  return () => { cancel = true; };
}, [table, type]);


  return (
    <div className="space-y-1">
      <label className="text-xs text-gray-600 block">{label}</label>
      <select
        className="w-full border rounded-md px-2 py-1"
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
      >
        <option value="">{loading ? 'در حال بارگذاری…' : '— انتخاب کنید —'}</option>
        {opts.map(o => (
          <option key={o.code} value={o.code}>{o.title}</option>
        ))}
      </select>
      {err && <div className="text-xs text-red-600">{err}</div>}
    </div>
  );
}
