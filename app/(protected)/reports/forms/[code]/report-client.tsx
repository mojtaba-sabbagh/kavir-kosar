'use client';
import { useEffect, useMemo, useState } from 'react';
import JDatePicker from '@/components/ui/JDatePicker';
import JDateTimePicker from '@/components/ui/JDateTimePicker';

type Field = { key:string; labelFa:string; type:string; config?: any };
type ReportConfig = {
  visibleColumns: string[];
  filterableKeys: string[];
  orderableKeys:  string[];
  defaultOrder?: { key:string; dir:'asc'|'desc' };
};

export default function ReportClient({ code }:{ code:string }) {
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<{ id:string; code:string; titleFa:string }|null>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [config, setConfig] = useState<ReportConfig|null>(null);

  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);

  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [orderKey, setOrderKey] = useState<string>('createdAt');
  const [orderDir, setOrderDir] = useState<'asc'|'desc'>('desc');
  const [filters, setFilters] = useState<Record<string, any>>({});

  // load schema
  useEffect(() => {
    (async () => {
      setLoading(true);
      // we look up schema by id via code: small helper endpoint below
      const s = await fetch(`/api/reports/form-by-code/${encodeURIComponent(code)}/schema`, { cache:'no-store' });
      const j = await s.json();
      setForm(j.form);
      setFields(j.fields);
      setConfig(j.config ?? { visibleColumns: [], filterableKeys: [], orderableKeys: [] });
      setOrderKey(j.config?.defaultOrder?.key ?? 'createdAt');
      setOrderDir(j.config?.defaultOrder?.dir ?? 'desc');
      setLoading(false);
    })();
  }, [code]);

  // load data
  useEffect(() => {
    (async () => {
      if (!form) return;
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (orderKey) params.set('orderKey', orderKey);
      if (orderDir) params.set('orderDir', orderDir);
      if (filters && Object.keys(filters).length) params.set('filters', JSON.stringify(filters));

      const r = await fetch(`/api/reports/form/${encodeURIComponent(code)}/data?` + params.toString(), { cache: 'no-store' });
      const j = await r.json();
      setRows(j.items ?? []);
      setTotal(j.total ?? 0);
    })();
  }, [form, page, pageSize, orderKey, orderDir, filters, code]);

  const visible = useMemo(() => new Set(config?.visibleColumns ?? fields.map(f=>f.key)), [config, fields]);
  const orderables = useMemo(() => ['createdAt', ...(config?.orderableKeys ?? [])], [config]);

  if (loading) return <div className="p-4">در حال بارگذاری…</div>;
  if (!form) return <div className="p-4 text-red-600">فرم یافت نشد</div>;

  return (
    <div className="mx-auto max-w-6xl space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">گزارش: {form.titleFa}</h1>
        <div className="flex items-center gap-2">
          <select className="border rounded-md px-2 py-1" value={orderKey} onChange={e=>setOrderKey(e.target.value)}>
            {orderables.map(k => <option key={k} value={k}>{k==='createdAt'?'تاریخ ایجاد':k}</option>)}
          </select>
          <select className="border rounded-md px-2 py-1" value={orderDir} onChange={e=>setOrderDir(e.target.value as any)}>
            <option value="asc">صعودی</option>
            <option value="desc">نزولی</option>
          </select>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border bg-white p-3 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {fields
            .filter(f => (config?.filterableKeys ?? []).includes(f.key))
            .map(f => (
              <FilterControl
                key={f.key}
                field={f}
                value={filters[f.key]}
                onChange={(val) => setFilters(prev => ({ ...prev, [f.key]: val }))}
              />
          ))}
        </div>

        <div className="text-left">
          <button className="rounded-md border px-3 py-1 hover:bg-gray-50" onClick={()=>{ setFilters({}); setPage(1); }}>
            پاک‌سازی فیلترها
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-right text-gray-600">
              <th className="p-2">تاریخ ایجاد</th>
              {fields.filter(f => visible.has(f.key)).map(f => (
                <th key={f.key} className="p-2">{f.labelFa}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r:any) => (
              <tr key={r.id} className="border-t">
                <td className="p-2" dir="ltr">{new Date(r.createdAt).toLocaleString('fa-IR')}</td>
                {fields.filter(f => visible.has(f.key)).map(f => (
                  <td key={f.key} className="p-2">{renderCell(f, r.payload?.[f.key])}</td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td className="p-4 text-gray-500" colSpan={1 + visible.size}>رکوردی یافت نشد</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500">تعداد کل: {total}</div>
        <div className="flex items-center gap-2">
          <button className="rounded-md border px-3 py-1 disabled:opacity-50" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>قبلی</button>
          <div className="text-sm">صفحه {page}</div>
          <button className="rounded-md border px-3 py-1 disabled:opacity-50"
            disabled={(page*pageSize)>=total}
            onClick={()=>setPage(p=>p+1)}
          >بعدی</button>
        </div>
      </div>
    </div>
  );
}

function renderCell(f: Field, v: any) {
  if (v == null || v === '') return <span className="text-gray-400">—</span>;
  if (f.type === 'number') return <span dir="ltr" className="font-mono">{String(v)}</span>;
  if (f.type === 'date' || f.type === 'datetime') return <span dir="ltr" className="font-mono">{new Date(v).toLocaleString('fa-IR')}</span>;
  if (f.type === 'checkbox') return <span>{v ? 'بله' : 'خیر'}</span>;
  if (f.type === 'select') {
    const opts = (f.config?.options ?? []) as Array<{value:string;label:string}>;
    return <span>{opts.find(o=>String(o.value)===String(v))?.label ?? String(v)}</span>;
  }
  if (f.type === 'multiselect' && Array.isArray(v)) {
    const opts = (f.config?.options ?? []) as Array<{value:string;label:string}>;
    const labels = v.map(x => opts.find(o=>String(o.value)===String(x))?.label ?? String(x)).join('، ');
    return <span>{labels}</span>;
  }
  return <span>{String(v)}</span>;
}

function FilterControl({ field, value, onChange }:{
  field: Field; value: any; onChange:(v:any)=>void;
}) {
  if (field.type === 'number') {
    return (
      <div>
        <label className="block text-sm mb-1">{field.labelFa} (از/تا)</label>
        <div className="flex gap-2">
          <input className="w-full border rounded-md px-2 py-1" dir="ltr" placeholder="min" value={value?.min ?? ''}
            onChange={e=>onChange({ ...value, min: e.target.value === '' ? undefined : Number(e.target.value) })}/>
          <input className="w-full border rounded-md px-2 py-1" dir="ltr" placeholder="max" value={value?.max ?? ''}
            onChange={e=>onChange({ ...value, max: e.target.value === '' ? undefined : Number(e.target.value) })}/>
        </div>
      </div>
    );
  }
  if (field.type === 'date') {
    return (
      <div>
        <label className="block text-sm mb-1">{field.labelFa} (از/تا)</label>
        <div className="flex gap-2">
          <input type="date" className="w-full border rounded-md px-2 py-1" dir="ltr" value={value?.from ?? ''}
            onChange={e=>onChange({ ...value, from: e.target.value || undefined })}/>
          <input type="date" className="w-full border rounded-md px-2 py-1" dir="ltr" value={value?.to ?? ''}
            onChange={e=>onChange({ ...value, to: e.target.value || undefined })}/>
        </div>
      </div>
    );
  }
  if (field.type === 'datetime') {
    return (
      <div>
        <label className="block text-sm mb-1">{field.labelFa} (از/تا)</label>
        <div className="flex gap-2">
          <input type="datetime-local" className="w-full border rounded-md px-2 py-1" dir="ltr" value={value?.from ?? ''}
            onChange={e=>onChange({ ...value, from: e.target.value || undefined })}/>
          <input type="datetime-local" className="w-full border rounded-md px-2 py-1" dir="ltr" value={value?.to ?? ''}
            onChange={e=>onChange({ ...value, to: e.target.value || undefined })}/>
        </div>
      </div>
    );
  }
  if (field.type === 'select') {
    const opts = (field.config?.options ?? []) as Array<{value:string;label:string}>;
    return (
      <div>
        <label className="block text-sm mb-1">{field.labelFa}</label>
        <select className="w-full border rounded-md px-2 py-1" value={value ?? ''} onChange={e=>onChange(e.target.value || undefined)}>
          <option value="">— همه —</option>
          {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    );
  }
  if (field.type === 'multiselect') {
    const opts = (field.config?.options ?? []) as Array<{value:string;label:string}>;
    return (
      <div>
        <label className="block text-sm mb-1">{field.labelFa}</label>
        <select multiple className="w-full border rounded-md px-2 py-1"
          value={Array.isArray(value) ? value : []}
          onChange={e => {
            const arr = Array.from(e.target.selectedOptions).map(o => o.value);
            onChange(arr.length ? arr : undefined);
          }}>
          {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    );
  }
  // default text contains
  return (
    <div>
      <label className="block text-sm mb-1">{field.labelFa}</label>
      <input className="w-full border rounded-md px-2 py-1"
        value={value ?? ''} onChange={e=>onChange(e.target.value || undefined)} />
    </div>
  );
}
