'use client';

import { useState } from 'react';
import type { Form, FormField, FieldType } from '@prisma/client';
import { isLtrField, optionLabel } from '@/lib/forms/field-utils';
import KardexPicker from './KardexPicker';
type Props = {
  form: Pick<Form, 'code'|'titleFa'>;
  fields: Pick<FormField, 'key'|'labelFa'|'type'|'required'|'config'|'order'>[];
};

export default function DynamicForm({ form, fields }: Props) {
  const sorted = [...fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const [values, setValues] = useState<Record<string, any>>({});
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

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setMsg(null); setErr(null);
    try {
      const res = await fetch(`/api/forms/submit?code=${encodeURIComponent(form.code)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
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
      <h2 className="text-xl font-bold mb-4">{form.titleFa}</h2>

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

              {f.type === 'date' && (
                <input
                  type="date"
                  className={common}
                  dir="ltr"
                  value={values[f.key] ?? ''}
                  onChange={e => set(f.key, e.target.value)}
                />
              )}

              {f.type === 'datetime' && (
                <input
                  type="datetime-local"
                  className={common}
                  dir="ltr"
                  value={values[f.key] ?? ''}
                  onChange={e => set(f.key, e.target.value)}
                />
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