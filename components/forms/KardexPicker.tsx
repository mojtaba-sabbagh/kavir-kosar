// KardexPicker.tsx (patched)

'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type KardexItem = { id: string; code: string; nameFa: string; unit?: string | null };

export default function KardexPicker({
  label,
  value,
  onSelect,
  endpoint = '/api/kardex/search',
  minChars = 0,
  debounceMs = 250,
}: {
  label: string;
  value?: string;
  onSelect: (it: KardexItem) => void;
  endpoint?: string;
  minChars?: number;
  debounceMs?: number;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<KardexItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const blurTimer = useRef<number | null>(null);

  const updateRect = () => {
    if (!inputRef.current) return;
    setRect(inputRef.current.getBoundingClientRect());
  };

  useLayoutEffect(() => {
    updateRect();
    const onWin = () => updateRect();
    window.addEventListener('resize', onWin);
    window.addEventListener('scroll', onWin, true);
    return () => {
      window.removeEventListener('resize', onWin);
      window.removeEventListener('scroll', onWin, true);
    };
  }, []);

  // 🔧 NEW: sync with parent reset — when value is cleared, flush internal state
  useEffect(() => {
    if (!value) {
      setQ('');
      setItems([]);
      setOpen(false);
      setErr(null);
    }
    // If you want to reflect a non-empty value into the input, you could also setQ here.
    // else { setQ(''); } // prefer leaving search empty and show the helper line below.
  }, [value]);

  // Close when clicking outside
  useEffect(() => {
    const onDocPointerDown = (e: PointerEvent) => {
      if (!inputRef.current) return;
      const t = e.target as Node;
      if (inputRef.current.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onDocPointerDown, { passive: true });
    return () => document.removeEventListener('pointerdown', onDocPointerDown);
  }, []);

  // Debounce
  function useDebounce<T>(val: T, ms = 250) {
    const [v, setV] = useState(val);
    useEffect(() => {
      const id = setTimeout(() => setV(val), ms);
      return () => clearTimeout(id);
    }, [val, ms]);
    return v;
  }
  const dq = useDebounce(q, debounceMs);

  // Shared fetcher (supports empty query)
  async function fetchItems(signal: AbortSignal, query: string) {
    const url = new URL(endpoint, window.location.origin);
    if (query.trim().length > 0) url.searchParams.set('q', query.trim());
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch(url.toString(), { cache: 'no-store', signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json().catch(() => ({}));
      const arr: KardexItem[] = (j.items ?? j.rows ?? []) as KardexItem[];
      const next = Array.isArray(arr) ? arr : [];
      setItems(next);
      setOpen(next.length > 0);
    } catch (e) {
      if ((e as any)?.name === 'AbortError') return;
      setErr('خطا در جستجو');
      setItems([]);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  // Fetch when typing (including empty if allowed by minChars=0)
  useEffect(() => {
    const need = dq.trim().length >= minChars;
    if (!need) {
      setItems([]);
      setOpen(false);
      setErr(null);
      return;
    }
    const ctrl = new AbortController();
    fetchItems(ctrl.signal, dq);
    return () => ctrl.abort();
  }, [dq, minChars]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch on focus (so it shows a default list even before typing)
  const handleFocus = () => {
    updateRect();
    if (items.length > 0) {
      setOpen(true);
      return;
    }
    if (minChars === 0) {
      const ctrl = new AbortController();
      fetchItems(ctrl.signal, '');
    }
  };

  // Blur handling for mobile
  const scheduleClose = () => {
    blurTimer.current = window.setTimeout(() => setOpen(false), 120) as unknown as number;
  };
  const cancelScheduledClose = () => {
    if (blurTimer.current) {
      clearTimeout(blurTimer.current);
      blurTimer.current = null;
    }
  };

  return (
    <div className="relative" dir="rtl">
      <input
        ref={inputRef}
        className="w-full rounded-md border px-3 py-2"
        placeholder={label}
        dir="rtl"
        inputMode="search"
        autoComplete="off"
        value={q}
        onChange={(e) => { setQ(e.target.value); updateRect(); }}
        onFocus={handleFocus}
        onBlur={scheduleClose}
        onClick={() => { updateRect(); if (items.length > 0) setOpen(true); }}
      />

      {loading && <div className="mt-1 text-xs text-gray-500">در حال جستجو…</div>}
      {err && <div className="mt-1 text-xs text-red-600">{err}</div>}
      {/* When there is a selected code from parent but no current search text, show it as a hint */}
      {value && !q && <div className="mt-1 text-xs text-gray-500 font-mono ltr">{value}</div>}

      {open && items.length > 0 && rect && typeof window !== 'undefined' && createPortal(
        <ul
          role="listbox"
          style={{
            position: 'fixed',
            top: rect.bottom + 4,
            left: rect.left,
            width: rect.width,
            maxHeight: '16rem',
            zIndex: 10000,
          }}
          className="overflow-auto rounded-md border bg-white shadow-lg"
          onPointerDown={(e) => { e.preventDefault(); cancelScheduledClose(); }}
          onMouseDown={(e) => { e.preventDefault(); cancelScheduledClose(); }}
        >
          {items.map((it) => (
            <li
              key={it.id}
              role="option"
              tabIndex={-1}
              className="px-3 py-2 hover:bg-blue-50 cursor-pointer flex items-center justify-between pointer-events-auto"
              onPointerDown={(e) => {
                e.preventDefault();
                cancelScheduledClose();
                onSelect(it);
                // Keep a human-readable label in the box
                setQ(`${it.nameFa} — ${it.code}`);
                setOpen(false);
              }}
              onMouseDown={(e) => e.preventDefault()}
            >
              <span>{it.nameFa}</span>
              <span className="text-xs text-gray-500 font-mono ltr">{it.code}</span>
            </li>
          ))}
        </ul>,
        document.body
      )}
    </div>
  );
}
// End of KardexPicker.tsx