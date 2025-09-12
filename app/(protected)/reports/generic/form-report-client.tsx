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

  // …inside the component:
const [entryModal, setEntryModal] = useState<{
  open: boolean; id?: string; loading?: boolean; data?: any; error?: string | null;
}>({ open: false, loading: false, error: null });

// cache for link labels to avoid refetch each render
const [entryLabelCache, setEntryLabelCache] = useState<Record<string, string>>({});
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


function renderValueGeneric(
    key: string,
    value: any,
    schemaArr: { key: string; type: string; config?: any }[] | undefined,
    maps: Record<string, Record<string, string>> | undefined
) {
  const t = schemaArr?.find(s => s.key === key)?.type;

  // entryRef / entryRefMulti handled by the table renderer (links). For modal, show plain mapped values:
  if (t === 'entryRef' || t === 'entryRefMulti') {
    if (Array.isArray(value)) return value.join('، ');
    return value ?? '';
  }

  // date / datetime
  if (t === 'date' && value) return formatJalali(value, false);
  if (t === 'datetime' && value) return formatJalali(value, true);

  // select-like (includes tableSelect & kardexItem because we pass maps)
  const map = maps?.[key];
  if (Array.isArray(value)) return value.map(v => map?.[String(v)] ?? String(v)).join('، ');
  if (value == null) return '';
  return map?.[String(value)] ?? String(value);
}

  // Render cell by type + map
  function renderCell(key: string, value: any) {
    const t = typeByKey[key];

      // 1) entryRef -> clickable link with form title
    if (t === 'entryRef' && typeof value === 'string' && value) {
      const label = entryLabelCache[value];
      if (!label) {
        // lazy load label (non-blocking)
        ensureEntryLabel(value);
      }
      return (
        <button
          type="button"
          className="text-blue-600 hover:underline"
          onClick={() => openEntryModal(value)}
          title="مشاهده جزئیات"
        >
          {label || '...'}
        </button>
      );
    }

    // 1b) entryRefMulti -> chips of links
    if (t === 'entryRefMulti' && Array.isArray(value)) {
      return (
        <div className="flex flex-wrap gap-1">
          {value.map((id: any, i: number) => {
            if (typeof id !== 'string' || !id) return null;
            const lbl = entryLabelCache[id];
            if (!lbl) ensureEntryLabel(id);
            return (
              <button
                key={`${id}-${i}`}
                type="button"
                className="rounded-full border px-2 py-0.5 text-xs hover:bg-gray-50 text-blue-700 border-blue-200"
                onClick={() => openEntryModal(id)}
                title="مشاهده جزئیات"
              >
                {lbl || '...'}
              </button>
            );
          })}
        </div>
      );
    }
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
              const cfg = (field?.config ?? {}) as any;
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

              if (t === 'select' || t === 'multiselect') {
                const opts: Array<{ value: string; label: string }> = Array.isArray(cfg.options) ? cfg.options : [];
                return (
                  <div key={k} className="space-y-1">
                    <label className="text-xs text-gray-600 block">{label}</label>

                    {/* single-select filter; feel free to switch to multiple if you want */}
                    <select
                      className="w-full border rounded-md px-2 py-1"
                      dir="rtl"
                      value={v ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFilters(prev => {
                          const next = { ...prev };
                          if (!val) delete next[k]; else next[k] = val;
                          return next;
                        });
                      }}
                    >
                      <option value="">همه</option>
                      {opts.map((o, i) => (
                        <option key={`${k}-${i}-${String(o.value)}`} value={String(o.value)}>
                          {String(o.label ?? o.value)}
                        </option>
                      ))}
                    </select>
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
      <Modal open={entryModal.open} onClose={() => setEntryModal({ open: false })}>
        {entryModal.loading && <div className="text-sm text-gray-600">در حال بارگذاری…</div>}
        {entryModal.error && <div className="text-sm text-red-600">{entryModal.error}</div>}

        {entryModal.data && (
          <div dir="rtl" className="space-y-3">
            <div className="font-bold text-base">{entryModal.data.formTitle}</div>
            <div className="text-xs text-gray-500 ltr">
              {formatJalali(entryModal.data.createdAt, true)} • {statusFa(entryModal.data.status)}
            </div>

            <div className="divide-y">
              {Object.entries(entryModal.data.payload || {}).map(([k, v]: any) => {
                const lbl = entryModal.data.labels?.[k] || k;
                const rendered = renderValueGeneric(
                  k,
                  v,
                  entryModal.data.schema,
                  entryModal.data.displayMaps
                );
                return (
                  <div key={k} className="py-2 grid grid-cols-3 gap-2">
                    <div className="text-gray-600 text-sm">{lbl}</div>
                    <div className="col-span-2 text-sm break-words">{rendered}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
    </Modal>
  </div>
  );

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
async function ensureEntryLabel(id: string) {
  if (entryLabelCache[id]) return entryLabelCache[id];
  try {
    const r = await fetch(`/api/entries/${id}/summary`, { cache: 'no-store' });
    const j = await r.json();
    const label = j?.formTitle || 'مشاهده';
    setEntryLabelCache(prev => ({ ...prev, [id]: label }));
    return label;
  } catch {
    return 'مشاهده';
  }
}

async function openEntryModal(id: string) {
  setEntryModal({ open: true, id, loading: true, error: null });
  try {
    const r = await fetch(`/api/entries/${id}/summary`, { cache: 'no-store' });
    const j = await r.json();
    if (!r.ok || !j?.ok) throw new Error(j?.message || 'خطا');
    setEntryModal({ open: true, id, loading: false, data: j, error: null });
    // also cache label if not yet cached
    if (j?.formTitle) {
      setEntryLabelCache(prev => prev[id] ? prev : { ...prev, [id]: j.formTitle });
    }
  } catch (e: any) {
    setEntryModal({ open: true, id, loading: false, error: e?.message || 'خطا' });
  }
}

function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl rounded-xl bg-white shadow-lg border p-4 overflow-auto max-h-[80vh]">
          <div className="text-left">
            <button className="text-sm text-gray-500 hover:text-gray-700" onClick={onClose}>بستن</button>
          </div>
          <div className="mt-2">{children}</div>
        </div>
      </div>
    </div>
  );
}
}