'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Props = {
  label: string;
  value: string;
  onChange: (val: string) => void;
  config: { table?: string; type?: string };
};

export default function TableSelectInput({ label, value, onChange, config }: Props) {
  const table = (config?.table || 'fixedInformation').trim();
  const type  = (config?.type  || '').trim();

  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [opts, setOpts] = useState<{ value: string; label: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const mounted = useRef(false);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    p.set('table', table);
    if (type) p.set('type', type);
    if (q) p.set('q', q);
    p.set('limit', '100');
    return `?${p.toString()}`;
  }, [table, type, q]);

  // Fetch when opened or query changes
  useEffect(() => {
    if (!open) return;
    let cancel = false;
    (async () => {
      setLoading(true); setErr(null);
      try {
        const res = await fetch(`/api/table-select${qs}`, { cache: 'no-store' });
        const j = await res.json();
        if (!res.ok || !j.ok) throw new Error(j.message || 'خطا در دریافت اطلاعات');
        if (!cancel) setOpts(j.options || []);
      } catch (e: any) {
        if (!cancel) setErr(e?.message || 'خطا');
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [open, qs]);

  // Open and initial load on first mount if you want to prefill
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      // optional: open once to preload
      // setOpen(true);
    }
  }, []);

  const selectedLabel = useMemo(() => {
    const f = opts.find(o => o.value === value);
    return f?.label || '';
  }, [opts, value]);

  return (
    <div className="space-y-1" dir="rtl">

      <div
        className="relative"
        onFocus={() => setOpen(true)}
        onBlur={(e) => {
          // close only when leaving the whole widget
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
        }}
      >
        {/* Search box (read-only if you prefer) */}
        <input
          className="w-full border rounded-md px-3 py-2"
          placeholder="جستجو…"
          value={open ? q : selectedLabel}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
        />

        {/* Dropdown */}
        {open && (
          <div className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-white shadow">
            {loading && <div className="px-3 py-2 text-sm text-gray-500">در حال جستجو…</div>}
            {err && <div className="px-3 py-2 text-sm text-red-600">{err}</div>}

            {!loading && !err && opts.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-500">نتیجه‌ای یافت نشد</div>
            )}

            {!loading && !err && opts.map((o) => (
              <button
                key={o.value}
                type="button"
                className={`block w-full text-right px-3 py-2 hover:bg-gray-50 ${o.value === value ? 'bg-blue-50' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(o.value); // store **code**
                  setOpen(false);
                }}
              >
                {o.label} <span className="text-xs text-gray-500 ltr">({o.value})</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
