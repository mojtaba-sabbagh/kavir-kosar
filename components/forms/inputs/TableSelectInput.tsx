'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Props = {
  label: string;
  value: string;
  currentTitle?: string; // cached title when the option isn't in the first page
  onChange: (val: string, optionalTitle?: string) => void;
  config: { table?: string; type?: string };
};

export default function TableSelectInput({ label, value, currentTitle, onChange, config }: Props) {
  const table = (config?.table || 'fixedInformation').trim();
  const type  = (config?.type  || '').trim();

  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [opts, setOpts] = useState<{ value: string; label: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const mounted = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null); // NEW

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    p.set('table', table);
    if (type) p.set('type', type);
    if (q) p.set('q', q);
    p.set('limit', '100');
    return `?${p.toString()}`;
  }, [table, type, q]);

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

  useEffect(() => {
    if (!mounted.current) mounted.current = true;
  }, []);

  const selectedLabel = useMemo(() => {
    const f = opts.find(o => o.value === value);
    return f?.label || currentTitle || '';
  }, [opts, value, currentTitle]);

  return (
    <div className="space-y-1" dir="rtl">
      <div
        className="relative"
        onFocus={() => setOpen(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
        }}
      >
        <div className="flex gap-2">
          <input
            ref={inputRef}
            className="w-full border rounded-md px-3 py-2"
            placeholder={open ? 'جستجو…' : (label || 'انتخاب کنید…')}
            value={open ? q : selectedLabel}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}                       
            onKeyDown={(e) => {                              
              if (!open) {
                // printable keys only
                if (e.key.length === 1 || e.key === 'Backspace') {
                  setOpen(true);
                  if (e.key === 'Backspace') {
                    setQ(prev => prev.slice(0, -1));
                  } else if (e.key.length === 1) {
                    setQ(prev => prev + e.key);
                  }
                  e.preventDefault(); // avoid mutating the closed-state display text
                }
              }
            }}
          />

          {/* Optional clear button */}
          {value && (
            <button
              type="button"
              className="shrink-0 rounded-md border px-2 py-1"
              onClick={() => {
                onChange('', '');    // clear selection
                setQ('');
                // keep focus and reopen so user can immediately search again
                setOpen(true);
                inputRef.current?.focus();
              }}
              title="پاک کردن"
            >
              ×
            </button>
          )}
        </div>

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
                onMouseDown={(e) => e.preventDefault()} // keep focus inside wrapper (prevents blur)
                onClick={() => {
                  onChange(o.value, o.label);
                  setOpen(false);
                  // (Optional) blur to ensure the next click triggers onFocus again:
                  // inputRef.current?.blur();
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
