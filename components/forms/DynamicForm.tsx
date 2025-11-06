// /components/forms/DynamicForm

'use client';

import { useState } from 'react';
import type { Form, FormField, FieldType } from '@prisma/client';
import { isLtrField, optionLabel } from '@/lib/forms/field-utils';
import KardexPicker from './KardexPicker';
import JDatePicker from '@/components/ui/JDatePicker';
import JDateTimePicker from '@/components/ui/JDateTimePicker';
import TableSelectInput from './inputs/TableSelectInput';
import Link from 'next/link';

type Props = {
  form: Pick<Form, 'code'|'titleFa'>;
  fields: Pick<FormField, 'key'|'labelFa'|'type'|'required'|'config'|'order'>[];
};

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN = '۰۱۲۳۴۵۶۷۸۹';

function toEnglishDigits(s: string): string {
  if (!s) return s;
  // unify thousands/decimal separators
  // Arabic thousands: U+066C '٬' ; Arabic decimal: U+066B '٫' ; Arabic comma: U+060C '،'
  let t = s.replace(/\u066C|,/g, '')            // remove thousands separators
           .replace(/\u066B|\u060C/g, '.');     // convert Arabic decimal/comma to dot

  // convert Persian & Arabic-Indic digits to ASCII
  t = t.replace(/[۰-۹]/g, d => String(PERSIAN.indexOf(d)))
       .replace(/[٠-٩]/g, d => String(ARABIC_INDIC.indexOf(d)));

  // trim spaces
  return t.trim();
}

function isNumericLike(s: string): boolean {
  const en = toEnglishDigits(s);
  return /^-?\d+(\.\d+)?$/.test(en);
}

function fmtFaDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(+d)) return String(iso);
  return new Intl.DateTimeFormat("fa-IR", { dateStyle: "short" }).format(d);
}

function fmtFaTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(+d)) return String(iso);
  return new Intl.DateTimeFormat("fa-IR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function resolveDefaultValue(field: Pick<FormField, 'type' | 'config'>): any {
  const cfg = (field.config ?? {}) as any;
  
  if (cfg.defaultValue === undefined) {
    return getEmptyValueForType(field.type);
  }

  switch (field.type) {
    case 'date':
      if (cfg.defaultValue === 'today') {
        return new Date().toISOString().split('T')[0];
      }
      return cfg.defaultValue;

    case 'datetime':
      if (cfg.defaultValue === 'now') {
        return new Date().toISOString();
      }
      return cfg.defaultValue;

    case 'checkbox':
      return Boolean(cfg.defaultValue);

    case 'number':
      return cfg.defaultValue === '' ? '' : Number(cfg.defaultValue);

    case 'multiselect':
      return Array.isArray(cfg.defaultValue) ? cfg.defaultValue : [];

    case 'tableSelect':
    case 'kardexItem':
      // For these types, defaultValue is the code string
      return cfg.defaultValue || '';

    default:
      return cfg.defaultValue;
  }
}

function getEmptyValueForType(type: string): any {
  switch (type) {
    case 'multiselect':
      return [];
    case 'checkbox':
      return false;
    case 'number':
      return '';
    case 'tableSelect':
    case 'kardexItem':
      return ''; // Empty string for code-based fields
    default:
      return '';
  }
}

export default function DynamicForm({ form, fields }: Props) {
  const sorted = [...fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // Initialize form values with defaults
  // Update the getInitialValues function in DynamicForm
const getInitialValues = () => {
  const initial: Record<string, any> = {};
  sorted.forEach(field => {
    const cfg = (field.config ?? {}) as any;
    
    if (cfg.defaultValue !== undefined) {
      // For tableSelect and kardexItem, store the code as value
      if (field.type === 'tableSelect' || field.type === 'kardexItem') {
        initial[field.key] = cfg.defaultValue;
      } else {
        // Handle other field types as before
        initial[field.key] = resolveDefaultValue(field);
      }
    } else {
      // Set empty defaults
      switch (field.type) {
        case 'multiselect':
          initial[field.key] = [];
          break;
        case 'checkbox':
          initial[field.key] = false;
          break;
        case 'number':
          initial[field.key] = '';
          break;
        case 'tableSelect':
        case 'kardexItem':
          initial[field.key] = ''; // Empty string for single selection
          break;
        default:
          initial[field.key] = '';
      }
    }
  });
  return initial;
};

  const [values, setValues] = useState<Record<string, any>>(getInitialValues());
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const set = (k: string, v: any) => setValues(prev => ({ ...prev, [k]: v }));

  async function handleFileUpload(file: File) {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/uploads', { method: 'POST', body: fd });
    if (!res.ok) throw new Error((await res.json().catch(()=>({}))).message || 'خطا در بارگذاری');
    const json = await res.json();
    return json.storageKey as string; // e.g., /uploads/123.png
  }
  const coerceValues = (
    fields: Pick<FormField, 'key'|'type'|'config'>[],
    vals: Record<string, any>
  ) => {
    const out: Record<string, any> = { ...vals };

    for (const f of fields) {
      if (f.type === 'number') {
        const raw = out[f.key];
        if (raw === '' || raw == null) { out[f.key] = null; continue; }
        const en = toEnglishDigits(String(raw));
        const n = (f.config as any)?.decimals ? parseFloat(en) : parseInt(en, 10);
        out[f.key] = Number.isFinite(n) ? n : null;
      }
      // If you later support group/repeatable with nested number fields,
      // recurse into their children here.
    }
    return out;
  };
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setMsg(null); setErr(null);
    try {
      const payload = coerceValues(sorted, values);
      const res = await fetch(`/api/forms/submit?code=${encodeURIComponent(form.code)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setMsg('ثبت شد');
        setValues({});
      } else {
        const j = await res.json().catch(()=>({}));
        setErr(j.message || 'خطا در ثبت');
      }
    } catch {
      setErr('خطای شبکه');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl">
        <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm mb-4">
          <h2 className="text-xl font-bold mb-4">{form.titleFa}</h2>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-md border px-3 py-1 text-sm hover:bg-purple-50"
            title="بازگشت به خانه"
            prefetch
          >
            <span aria-hidden>←</span>
            <span>بازگشت</span>
          </Link>
        </div>

      <form onSubmit={onSubmit} className="rounded-2xl bg-white p-4 border space-y-4">
        {sorted.map(f => {
          const cfg = (f.config ?? {}) as any;
          const common = "w-full rounded-md border px-3 py-2";
          const ltr = isLtrField(f.type as FieldType, f.key) ? 'ltr' : 'rtl';

          return (
            <div key={f.key}>
              <label className="block text-sm mb-1">
                {f.labelFa}{f.required ? ' *' : ''}
              </label>

              {f.type === 'text' && (
                <input
                  className={common}
                  dir={ltr}
                  value={values[f.key] ?? ''}
                  onChange={e => set(f.key, e.target.value)}
                />
              )}

              {f.type === 'textarea' && (
                <textarea
                  className={common}
                  dir="rtl"
                  rows={cfg.rows ?? 4}
                  value={values[f.key] ?? ''}
                  onChange={e => set(f.key, e.target.value)}
                />
              )}

              {f.type === 'number' && (
                <input
                  type="text"                  // <— important: not "number"
                  inputMode="decimal"          // mobile numeric keypad
                  className={common}
                  dir="ltr"                    // keep left-to-right for readability
                  value={values[f.key] ?? ''}
                  onChange={(e) => {
                    // allow digits (ASCII, Persian, Arabic-Indic), decimal separators, minus sign
                    const raw = e.target.value;
                    const cleaned = raw.replace(/[^\d۰-۹٠-٩\.\u066B\u060C\u066C-]/g, '');
                    set(f.key, cleaned);
                  }}
                  placeholder={cfg.placeholder ?? ''}
                  pattern={cfg.decimals
                    ? "[0-9٠-٩۰-۹]+([\\.\\u066B\\u060C][0-9٠-٩۰-۹]+)?"
                    : "[0-9٠-٩۰-۹]+"}
                  title="فقط عدد وارد کنید (ارقام فارسی هم مجاز است)"
                />
              )}

              {f.type === 'date' && (
                <JDatePicker
                  value={(values[f.key] as string | undefined) ?? null}
                  onChange={(iso) => set(f.key, iso)}
                />
              )}

              {f.type === "datetime" && (
                <div className="flex items-center gap-3">
                   {/* DateTime picker at half width */}
                  <div className="w-1/2 min-w-[260px]">
                    <JDateTimePicker
                      value={(values[f.key] as string | undefined) ?? null}
                      onChange={(iso) => set(f.key, iso)}
                    />
                  </div>
                  {/* Time preview BEFORE the picker (no date) */}
                  <div className="text-sm font-semibold text-gray-700 shrink-0">
                    <span>
                      {fmtFaTime(values[f.key] as string | undefined)}
                    </span>
                  </div>
                </div>
              )}
              {f.type === 'checkbox' && (
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!values[f.key]}
                    onChange={e => set(f.key, e.target.checked)}
                  />
                  <span>بله</span>
                </label>
              )}

              {f.type === 'select' && (
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

              {f.type === 'multiselect' && (
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

              {f.type === 'file' && (
                <input
                  type="file"
                  className={common}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      setErr(null);
                      const key = await handleFileUpload(file);
                      set(f.key, key); // save storageKey in payload
                    } catch (ex: any) {
                      setErr(ex?.message || 'خطا در بارگذاری فایل');
                    }
                  }}
                />
              )}

              {/* entryRef */}
              {f.type === 'entryRef' && (
                <EntryPicker
                  value={values[f.key] as string | undefined}
                  onChange={(v)=>set(f.key, v)}
                  allowedFormCodes={(cfg?.allowedFormCodes as string[] | undefined)}
                />
              )}

              {/* entryRefMulti */}
              {f.type === 'entryRefMulti' && (
                <EntryMultiPicker
                  value={(values[f.key] as string[] | undefined) ?? []}
                  onChange={(arr)=>set(f.key, arr)}
                  allowedFormCodes={(cfg?.allowedFormCodes as string[] | undefined)}
                />
              )}

              {/* kardexItem */}
              {f.type === 'kardexItem' && (
                <KardexPicker
                  label={f.labelFa}
                  value={values[f.key] || ''}
                  onSelect={(it) => {
                    // store the chosen code in your payload
                    set(f.key, it.code);
                    // optionally store name too if you have a companion key in config
                    if ((f.config as any)?.nameKey) {
                      set((f.config as any).nameKey, it.nameFa);
                    }
                  }}
                />
              )}

              {/* tableSelect */}
              {f.type === 'tableSelect' && (
                <TableSelectInput
                  label={f.labelFa}
                  value={(values[f.key] as string) ?? ''}
                  onChange={(val: string) => set(f.key, val)}   // store the selected code
                  config={(cfg?.tableSelect ?? cfg ?? {}) as { table?: string; type?: string }}
                />
              )}
              
              {/* Add other field types as needed */}
            </div>
          );
        })}
        
        {err && <div className="text-red-600 text-sm">{err}</div>}
        {msg && <div className="text-green-600 text-sm">{msg}</div>}
        <button
          className="w-full rounded-md bg-blue-600 text-white py-2 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'در حال ثبت…' : 'ثبت'}
        </button>
      </form>
    </div>
  );
}

function EntryPicker({
  value,
  onChange,
  allowedFormCodes,
}: { value?: string; onChange: (v: string|undefined) => void; allowedFormCodes?: string[] }) {
  const [items, setItems] = useState<{id:string; label:string}[]>([]);
  const [q, setQ] = useState('');
  async function search() {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    (allowedFormCodes ?? []).forEach(c => params.append('code', c));
    const res = await fetch(`/api/entries/search?${params.toString()}`, { cache: 'no-store' });
    const j = await res.json();
    setItems((j.items ?? []).map((i:any)=>({id:i.id, label:i.label})));
  }
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input className="w-full rounded-md border px-3 py-2" dir="ltr" value={q} onChange={e=>setQ(e.target.value)} placeholder="جستجو..." />
        <button type="button" className="rounded-md border px-3 py-2 hover:bg-gray-50" onClick={search}>جستجو</button>
      </div>
      <select className="w-full rounded-md border px-3 py-2" dir="ltr" value={value ?? ''} onChange={e=>onChange(e.target.value || undefined)}>
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
  const [items, setItems] = useState<{id:string; label:string}[]>([]);
  const [q, setQ] = useState('');
  async function search() {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    (allowedFormCodes ?? []).forEach(c => params.append('code', c));
    const res = await fetch(`/api/entries/search?${params.toString()}`, { cache: 'no-store' });
    const j = await res.json();
    setItems((j.items ?? []).map((i:any)=>({id:i.id, label:i.label})));
  }
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input className="w-full rounded-md border px-3 py-2" dir="ltr" value={q} onChange={e=>setQ(e.target.value)} placeholder="جستجو..." />
        <button type="button" className="rounded-md border px-3 py-2 hover:bg-gray-50" onClick={search}>جستجو</button>
      </div>
      <select
        multiple
        className="w-full rounded-md border px-3 py-2"
        dir="ltr"
        value={value}
        onChange={e => {
          const arr = Array.from(e.target.selectedOptions).map(o => o.value);
          onChange(arr);
        }}
      >
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
  renderAtomic, // (innerField, innerValue, setInner) => ReactNode
}: {
  fieldKey: string;
  label: string;
  cfg: any;         // cfg.group
  value: any;       // [] | {} | undefined
  onChange: (v: any) => void;
  renderAtomic: (f: any, v: any, setV: (nv: any) => void) => React.ReactNode;
}) {
  const g = cfg.group || { repeatable: true, fields: [] as any[] };

  if (!g.repeatable) {
    const obj = (value && typeof value === 'object' && !Array.isArray(value)) ? value : {};
    const setObj = (k: string, v: any) => onChange({ ...obj, [k]: v });

    return (
      <div className="space-y-2">
        <div className="text-sm mb-1">{label}</div>
        {(g.fields || []).map((f: any) => (
          <div key={f.key}>
            {renderAtomic(f, obj[f.key], nv => setObj(f.key, nv))}
          </div>
        ))}
      </div>
    );
  }

  // repeatable
  const arr: any[] = Array.isArray(value) ? value : [];
  const add = () => onChange([...(arr || []), {}]);
  const del = (i: number) => onChange(arr.filter((_,idx)=>idx!==i));
  const setIdx = (i: number, k: string, v: any) =>
    onChange(arr.map((row, idx) => idx === i ? { ...row, [k]: v } : row));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm">{label}</div>
        <button type="button" className="rounded-md border px-2 py-1 hover:bg-gray-50" onClick={add}>افزودن</button>
      </div>

      {(arr || []).map((row, i) => (
        <div key={i} className="border rounded-md p-3 space-y-2">
          <div className="text-xs text-gray-500 mb-1">#{i+1}</div>
          {(g.fields || []).map((f: any) => (
            <div key={f.key}>
              {renderAtomic(f, row?.[f.key], nv => setIdx(i, f.key, nv))}
            </div>
          ))}
          <div className="text-left">
            <button type="button" className="text-xs text-red-600 hover:underline" onClick={()=>del(i)}>حذف ردیف</button>
          </div>
        </div>
      ))}

      {(!arr || arr.length === 0) && <div className="text-xs text-gray-500">هیچ ردیفی اضافه نشده است</div>}
    </div>
  );
}
