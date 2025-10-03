'use client';

import { useState, useEffect, useMemo } from 'react';
import type { Form, FormField, FormEntry, FieldType } from '@prisma/client';
import { isLtrField, optionLabel } from '@/lib/forms/field-utils';
import KardexPicker from './KardexPicker';
import JDatePicker from '@/components/ui/JDatePicker';
import JDateTimePicker from '@/components/ui/JDateTimePicker';
import TableSelectInput from './inputs/TableSelectInput';

type Props = {
  entry: FormEntry & {
    form: Pick<Form, 'code' | 'titleFa'>;
  };
  fields: Pick<FormField, 'key' | 'labelFa' | 'type' | 'required' | 'config' | 'order'>[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedData: Record<string, any>) => Promise<void>;
};

function normalizeKind(f: { type: any; config?: any }):
  | 'kardexItem' | 'tableSelect' | 'select' | 'multiselect'
  | 'date' | 'datetime' | 'number' | 'text' | 'textarea'
  | 'checkbox' | 'entryRef' | 'entryRefMulti' | 'group' | 'file' {
  const raw = String(f.type ?? '').toLowerCase();
  if (raw === 'kardexitem' || raw === 'kardex_item' || raw === 'kardex') return 'kardexItem';
  if (raw === 'tableselect' || raw === 'table_select') return 'tableSelect';
  if ((f as any)?.config?.tableSelect) return 'tableSelect';
  if (raw === 'multiselect') return 'multiselect';
  if (raw === 'entryref') return 'entryRef';
  if (raw === 'entryrefmulti') return 'entryRefMulti';
  if (raw === 'datetime') return 'datetime';
  if (raw === 'date') return 'date';
  if (raw === 'number') return 'number';
  if (raw === 'textarea') return 'textarea';
  if (raw === 'checkbox') return 'checkbox';
  if (raw === 'select') return 'select';
  if (raw === 'group') return 'group';
  if (raw === 'file') return 'file';
  return 'text';
}

// --- helpers ---------------------------------------------------------------

// Always extract a *code string* from either a raw string or an object {code,...}
function extractCode(v: any): string {
  if (v == null) return '';
  if (typeof v === 'object') {
    const raw = (v as any).code ?? (v as any).value ?? (v as any).id ?? '';
    return String(raw ?? '');
  }
  return String(v);
}

// convert payload value (ISO string like "2025-10-01") -> Date for JDatePicker
function toJSDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date && !isNaN(+val)) return val;
  if (typeof val === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(val);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  }
  return null;
}

// convert JDatePicker output (Date or string) -> ISO "YYYY-MM-DD"
function toIsoDate(val: any): string {
  if (!val) return '';
  const d = val instanceof Date ? val : new Date(val);
  if (isNaN(+d)) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function EditEntryModal({ entry, fields, isOpen, onClose, onSave }: Props) {
  const sorted = useMemo(
    () => [...fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [fields]
  );

  const [values, setValues] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // select/multiselect: key -> code->title
  const [selectMaps, setSelectMaps] = useState<Record<string, Record<string, string>>>({});
  // tableSelect: key -> code->title
  const [tsMaps, setTsMaps] = useState<Record<string, Record<string, string>>>({});
  // kardex: code -> "nameFa – code"
  const [kardexMap, setKardexMap] = useState<Record<string, string>>({});

  // Initialize values + prime select option maps
  useEffect(() => {
    if (!isOpen) return;
    const data = (entry as any).payload || (entry as any).data || {};
    setValues(data);

    const maps: Record<string, Record<string, string>> = {};
    for (const f of fields) {
      const cfg = (f.config ?? {}) as any;
      if ((f.type === 'select' || f.type === 'multiselect') && Array.isArray(cfg?.options)) {
        maps[f.key] = {};
        for (const o of cfg.options) {
          const v = o?.value;
          if (v != null) maps[f.key][String(v)] = String(optionLabel(o));
        }
      }
    }
    setSelectMaps(maps);
  }, [isOpen, entry, fields]);

  // --- fetch helpers -------------------------------------------------------
  async function fetchJson(url: string) {
    const r = await fetch(url, { cache: 'no-store', credentials: 'include' });
    if (!r.ok) return null;
    try {
      return await r.json();
    } catch {
      return null;
    }
  }

  // Get human title for a tableSelect code (EXACT MATCH ONLY)
// --- inside components/forms/EditEntryModal.tsx ---

// EXACT match only: resolve FixedInformation title(s) by code
    async function ensureTableSelectTitle(
    f: Pick<FormField, 'key' | 'config'>,
    code: string
    ) {
    if (!code) return;
    const key = f.key;

    // already cached?
    if (tsMaps[key]?.[code]) return;

    try {
        const r = await fetch(
        `/api/lookups/fixed?codes=${encodeURIComponent(code)}`,
        { cache: 'no-store', credentials: 'include' }
        );
        const j = await r.json().catch(() => null);
        const title =
        j?.items?.find((it: any) => String(it.code) === String(code))?.title;

        setTsMaps((prev) => ({
        ...prev,
        [key]: { ...(prev[key] || {}), [code]: title || String(code) },
        }));
    } catch {
        // keep code if title not found
        setTsMaps((prev) => ({
        ...prev,
        [key]: { ...(prev[key] || {}), [code]: String(code) },
        }));
    }
    }

  async function ensureKardexLabel(code: string, nameFromSnapshot?: string) {
    if (!code) return;
    if (kardexMap[code]) return;
    if (nameFromSnapshot?.trim()) {
      setKardexMap(prev => ({ ...prev, [code]: `${nameFromSnapshot} – ${code}` }));
      return;
    }
    try {
      const r = await fetch(`/api/kardex/items?code=${encodeURIComponent(code)}&limit=1`, { cache: "no-store" });
      const j = await r.json().catch(() => null);
      const it = j?.items?.[0];
      const label = it ? `${String(it.nameFa ?? "")} – ${it.code}` : code;
      setKardexMap(prev => ({ ...prev, [code]: label }));
    } catch {
      setKardexMap(prev => ({ ...prev, [code]: code }));
    }
  }

  // Prefetch labels for current saved values
  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      for (const f of fields) {
        const v = values[f.key];
        if (!v) continue;
        const kind = normalizeKind(f);

        if (kind === 'tableSelect') {
          const code = extractCode(v);
          if (code) await ensureTableSelectTitle(f as any, code);
        }
        if (kind === 'kardexItem') {
          const code = extractCode(v);
          if (code) {
            const nameKey = (f.config as any)?.nameKey as string | undefined;
            await ensureKardexLabel(code, nameKey ? values[nameKey] : undefined);
          }
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, fields, JSON.stringify(values)]);

  const set = (k: string, v: any) => setValues(prev => ({ ...prev, [k]: v }));

  async function handleFileUpload(file: File) {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/uploads', { method: 'POST', body: fd, credentials: 'include' });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'خطا در بارگذاری');
    const json = await res.json();
    return json.storageKey as string;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    setErr(null);

    try {
      await onSave(values);
      setMsg('با موفقیت به‌روزرسانی شد');
      setTimeout(() => {
        onClose();
      }, 900);
    } catch (error: any) {
      setErr(error?.message || 'خطا در به‌روزرسانی');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  function CurrentValueLine({ text }: { text?: string }) {
    if (!text) return null;
    return (
      <div className="text-xs text-gray-500 mb-1">
        مقدار فعلی: <span className="font-medium">{text}</span>
      </div>
    );
  }

  // Render current value using same idea as report (maps + fallbacks)
  function renderCurrentValueForField(f: Props['fields'][number]): string | undefined {
    const raw = values[f.key];
    const kind = normalizeKind(f);
    if (raw == null || raw === '') return undefined;

    if (kind === 'select') {
      const m = selectMaps[f.key] || {};
      return m[String(raw)] ?? String(raw);
    }
    if (kind === 'multiselect' && Array.isArray(raw)) {
      const m = selectMaps[f.key] || {};
      return raw.map((x: any) => m[String(x)] ?? String(x)).join('، ');
    }
    if (kind === 'tableSelect') {
      const code = extractCode(raw);
      const m = tsMaps[f.key] || {};
      return m[code] ?? (typeof raw === 'object' && (raw as any).title ? (raw as any).title : code);
    }
    if (kind === 'kardexItem') {
      const code = extractCode(raw);
      const nameKey = (f.config as any)?.nameKey as string | undefined;
      const snap = nameKey ? values[nameKey] : undefined;
      return kardexMap[code] || (snap ? `${snap} – ${code}` : code);
    }
    return undefined;
  }

  const renderField = (f: Props['fields'][0]) => {
    const cfg = (f.config ?? {}) as any;
    const kind = normalizeKind(f);
    const common =
      'w-full rounded-md border px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500';
    const ltr = isLtrField(f.type as FieldType, f.key) ? 'ltr' : 'rtl';
    const currentText = renderCurrentValueForField(f);

    // compute *code string* / *title* once for tableSelect
    const tsCode   = kind === 'tableSelect' ? extractCode(values[f.key]) : '';
    const tsTitle  = kind === 'tableSelect' ? (tsMaps[f.key]?.[tsCode] ?? '') : '';

    return (
      <div key={f.key} className="mb-4">
        <label className="block text-sm font-medium mb-1">
          {f.labelFa}
          {f.required ? ' *' : ''}
        </label>

        <CurrentValueLine text={currentText} />

        {kind === 'text' && (
          <input
            className={common}
            dir={ltr}
            value={values[f.key] ?? ''}
            onChange={e => set(f.key, e.target.value)}
          />
        )}

        {kind === 'textarea' && (
          <textarea
            className={common}
            dir="rtl"
            rows={cfg.rows ?? 4}
            value={values[f.key] ?? ''}
            onChange={e => set(f.key, e.target.value)}
          />
        )}

        {kind === 'number' && (
          <input
            type="number"
            inputMode="decimal"
            step={cfg.step ?? (cfg.decimals ? '0.01' : '1')}
            min={cfg.min ?? undefined}
            max={cfg.max ?? undefined}
            className={common}
            dir="ltr"
            value={values[f.key] ?? ''}
            onChange={e => set(f.key, e.target.value)}
            placeholder={cfg.placeholder ?? ''}
          />
        )}
        
        {kind === 'date' && (
        <div dir="ltr" className="w-full">
            <JDatePicker
            value={typeof values[f.key] === 'string' ? (values[f.key] as string) : null}
            onChange={(iso: string | null) => {
                set(f.key, iso ?? '');
            }}
            />
        </div>
        )}

        {kind === 'datetime' && (
          <JDateTimePicker
            value={(values[f.key] as string | undefined) ?? null}
            onChange={iso => set(f.key, iso)}
          />
        )}

        {kind === 'checkbox' && (
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!values[f.key]}
              onChange={e => set(f.key, e.target.checked)}
            />
            <span>بله</span>
          </label>
        )}

        {kind === 'select' && (
          <select
            className={common}
            dir="rtl"
            value={values[f.key] ?? (cfg?.default ?? '')}
            onChange={e => set(f.key, e.target.value)}
          >
            <option value="" disabled>انتخاب کنید…</option>
            {(cfg?.options ?? []).map((opt: any) => (
              <option key={String(opt.value)} value={String(opt.value)}>
                {optionLabel(opt)}
              </option>
            ))}
          </select>
        )}

        {kind === 'multiselect' && (
          <select
            multiple
            className={common}
            dir="rtl"
            value={(values[f.key] ?? []) as string[]}
            onChange={e => {
              const arr = Array.from(e.target.selectedOptions).map(o => o.value);
              set(f.key, arr);
            }}
          >
            {(cfg?.options ?? []).map((opt: any) => (
              <option key={String(opt.value)} value={String(opt.value)}>
                {optionLabel(opt)}
              </option>
            ))}
          </select>
        )}

        {kind === 'file' && (
          <div className="space-y-2">
            {values[f.key] && (
              <div className="text-sm text-green-600">
                فایل موجود: {String(values[f.key]).split('/').pop()}
              </div>
            )}
            <input
              type="file"
              className={common}
              onChange={async e => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  setErr(null);
                  const key = await handleFileUpload(file);
                  set(f.key, key);
                } catch (ex: any) {
                  setErr(ex?.message || 'خطا در بارگذاری فایل');
                }
              }}
            />
          </div>
        )}

        {kind === 'entryRef' && (
          <EntryPicker
            value={values[f.key] as string | undefined}
            onChange={v => set(f.key, v)}
            allowedFormCodes={(cfg?.allowedFormCodes as string[] | undefined)}
          />
        )}

        {kind === 'entryRefMulti' && (
          <EntryMultiPicker
            value={(values[f.key] as string[] | undefined) ?? []}
            onChange={arr => set(f.key, arr)}
            allowedFormCodes={(cfg?.allowedFormCodes as string[] | undefined)}
          />
        )}

        {kind === 'kardexItem' && (
          <KardexPicker
            label={f.labelFa}
            value={extractCode(values[f.key])}
            onSelect={it => {
              set(f.key, it.code); // keep code in payload
              const nameKey = (f.config as any)?.nameKey as string | undefined;
              if (nameKey) set(nameKey, it.nameFa);
              setKardexMap(prev => ({ ...prev, [it.code]: `${it.nameFa} – ${it.code}` }));
            }}
          />
        )}

        {kind === 'tableSelect' && (
          <TableSelectInput
            label={f.labelFa}
            value={tsCode}                       
            currentTitle={tsTitle || undefined}     
            onChange={(val: string, optionalTitle?: string) => {
              set(f.key, val);                        
              if (optionalTitle) {
                setTsMaps(prev => ({
                  ...prev,
                  [f.key]: { ...(prev[f.key] || {}), [val]: optionalTitle },
                }));
              } else {
                ensureTableSelectTitle(f as any, val);
              }
            }}
            config={((cfg?.tableSelect ?? cfg ?? {}) as { table?: string; type?: string })}
          />
        )}

        {kind === 'group' && (
          <GroupField
            fieldKey={f.key}
            label={f.labelFa}
            cfg={cfg}
            value={values[f.key]}
            onChange={v => set(f.key, v)}
            renderAtomic={(af: any, v: any, setV: (nv: any) => void) => {
              const lt = isLtrField(af.type as FieldType, af.key) ? 'ltr' : 'rtl';
              if (af.type === 'text')
                return (
                  <input className={common} dir={lt} value={v ?? ''} onChange={e => setV(e.target.value)} />
                );
              if (af.type === 'number')
                return (
                  <input
                    type="number"
                    className={common}
                    dir="ltr"
                    value={v ?? ''}
                    onChange={e => setV(e.target.value === '' ? null : Number(e.target.value))}
                  />
                );
              return (
                <input className={common} dir={lt} value={v ?? ''} onChange={e => setV(e.target.value)} />
              );
            }}
          />
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">ویرایش: {entry.form.titleFa}</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {sorted.map(renderField)}

            {err && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md">{err}</div>}
            {msg && <div className="text-green-600 text-sm bg-green-50 p-3 rounded-md">{msg}</div>}

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
                disabled={loading}
              >
                انصراف
              </button>
              <button
                type="submit"
                className="flex-1 rounded-md bg-blue-600 text-white px-4 py-2 text-sm hover:bg-blue-700 disabled:opacity-50"
                disabled={loading}
              >
                {loading ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ------------ Reused helpers (unchanged) ------------ */
function EntryPicker({
  value,
  onChange,
  allowedFormCodes,
}: { value?: string; onChange: (v: string | undefined) => void; allowedFormCodes?: string[] }) {
  const [items, setItems] = useState<{ id: string; label: string }[]>([]);
  const [q, setQ] = useState('');
  async function search() {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    (allowedFormCodes ?? []).forEach(c => params.append('code', c));
    const res = await fetch(`/api/entries/search?${params.toString()}`, { cache: 'no-store' });
    const j = await res.json();
    setItems((j.items ?? []).map((i: any) => ({ id: i.id, label: i.label })));
  }
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input className="w-full rounded-md border px-3 py-2" dir="ltr" value={q} onChange={e => setQ(e.target.value)} placeholder="جستجو..." />
        <button type="button" className="rounded-md border px-3 py-2 hover:bg-gray-50" onClick={search}>جستجو</button>
      </div>
      <select className="w-full rounded-md border px-3 py-2" dir="ltr" value={value ?? ''} onChange={e => onChange(e.target.value || undefined)}>
        <option value="">— انتخاب کنید —</option>
        {items.map(it => <option key={it.id} value={it.id}>{it.label}</option>)}
      </select>
    </div>
  );
}

function EntryMultiPicker({
  value,
  onChange,
  allowedFormCodes,
}: { value: string[]; onChange: (v: string[]) => void; allowedFormCodes?: string[] }) {
  const [items, setItems] = useState<{ id: string; label: string }[]>([]);
  const [q, setQ] = useState('');
  async function search() {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    (allowedFormCodes ?? []).forEach(c => params.append('code', c));
    const res = await fetch(`/api/entries/search?${params.toString()}`, { cache: 'no-store' });
    const j = await res.json();
    setItems((j.items ?? []).map((i: any) => ({ id: i.id, label: i.label })));
  }
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input className="w-full rounded-md border px-3 py-2" dir="ltr" value={q} onChange={e => setQ(e.target.value)} placeholder="جستجو..." />
        <button type="button" className="rounded-md border px-3 py-2 hover:bg-gray-50" onClick={search}> جستجو </button>
      </div>
      <select multiple className="w-full rounded-md border px-3 py-2" dir="ltr" value={value} onChange={e => {
        const arr = Array.from(e.target.selectedOptions).map(o => o.value);
        onChange(arr);
      }}>
        {items.map(it => <option key={it.id} value={it.id}>{it.label}</option>)}
      </select>
    </div>
  );
}

function GroupField({
  fieldKey,
  label,
  cfg,
  value,
  onChange,
  renderAtomic,
}: {
  fieldKey: string;
  label: string;
  cfg: any;
  value: any;
  onChange: (v: any) => void;
  renderAtomic: (f: any, v: any, setV: (nv: any) => void) => React.ReactNode;
}) {
  const g = cfg.group || { repeatable: true, fields: [] as any[] };

  if (!g.repeatable) {
    const obj = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const setObj = (k: string, v: any) => onChange({ ...obj, [k]: v });
    return (
      <div className="space-y-2 border rounded-md p-4">
        <div className="text-sm font-medium mb-2">{label}</div>
        {(g.fields || []).map((f: any) => (
          <div key={f.key}>{renderAtomic(f, (obj as any)[f.key], nv => setObj(f.key, nv))}</div>
        ))}
      </div>
    );
  }

  const arr: any[] = Array.isArray(value) ? value : [];
  const add = () => onChange([...(arr || []), {}]);
  const del = (i: number) => onChange(arr.filter((_, idx) => idx !== i));
  const setIdx = (i: number, k: string, v: any) =>
    onChange(arr.map((row, idx) => (idx === i ? { ...row, [k]: v } : row)));

  return (
    <div className="space-y-2 border rounded-md p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-medium">{label}</div>
        <button type="button" className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50" onClick={add}>افزودن</button>
      </div>

      {(arr || []).map((row, i) => (
        <div key={i} className="border rounded-md p-3 space-y-3 bg-gray-50">
          <div className="flex justify-between items-center">
            <div className="text-xs text-gray-500">#{i + 1}</div>
            <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => del(i)}>حذف ردیف</button>
          </div>
          {(g.fields || []).map((f: any) => (
            <div key={f.key}>{renderAtomic(f, row?.[f.key], nv => setIdx(i, f.key, nv))}</div>
          ))}
        </div>
      ))}

      {(!arr || arr.length === 0) && (
        <div className="text-xs text-gray-500 text-center py-4">هیچ ردیفی اضافه نشده است</div>
      )}
    </div>
  );
}
