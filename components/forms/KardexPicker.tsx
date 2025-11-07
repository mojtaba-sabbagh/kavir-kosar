'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type KardexItem = { id: string; code: string; nameFa: string; unit?: string | null };

// Digit conversion utilities
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

function normalizeSearchQuery(query: string): string {
  // Convert Farsi/Arabic digits to English
  const englishDigits = toEnglishDigits(query);
  
  // Remove extra spaces and normalize
  return englishDigits.trim().replace(/\s+/g, ' ');
}

export default function KardexPicker({
  label,
  value,
  onSelect,
  onClear, // 🆕 optional: notify parent to clear selected value
  endpoint = '/api/kardex/search',
  minChars = 0,
  debounceMs = 250,
}: {
  label: string;
  value?: string;
  onSelect: (it: KardexItem) => void;
  onClear?: () => void; // 🆕
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

  // 🔧 sync with parent reset — when value is cleared, flush internal state
  useEffect(() => {
    if (!value) {
      setQ('');
      setItems([]);
      setOpen(false);
      setErr(null);
    }
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
    // Normalize the query - convert Farsi digits to English
    const normalizedQuery = normalizeSearchQuery(query);
    
    const url = new URL(endpoint, window.location.origin);
    if (normalizedQuery.trim().length > 0) url.searchParams.set('q', normalizedQuery.trim());
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
    const normalizedQuery = normalizeSearchQuery(dq);
    const need = normalizedQuery.trim().length >= minChars;
    if (!need) {
      setItems([]);
      setOpen(false);
      setErr(null);
      return;
    }
    const ctrl = new AbortController();
    fetchItems(ctrl.signal, normalizedQuery);
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

  // Handle input change with digit conversion for display
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    setQ(rawValue); // Keep the raw value for display (user can type in Farsi)
    updateRect();
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

  // 🆕 Clear action (does NOT change selection logic)
  const handleClear = () => {
    setQ('');
    setItems([]);
    setOpen(false);
    setErr(null);
    onClear?.();           // let parent clear its selected value (if provided)
    inputRef.current?.focus();
  };

  return (
    <div className="relative" dir="rtl">
      {/* 🆕 Wrap input so we can place the clear button on the left */}
      <div className="relative">
        <input
          ref={inputRef}
          className="w-full rounded-md border pr-3 pl-9 py-2" // 🆕 left padding for the button
          placeholder={label}
          dir="rtl"
          inputMode="search"
          autoComplete="off"
          value={q}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={scheduleClose}
          onClick={() => { updateRect(); if (items.length > 0) setOpen(true); }}
        />

        {/* 🆕 Clear button (left side) — shown when input has text OR parent has a selected value */}
        {(q || value) && (
          <button
            type="button"
            aria-label="پاک کردن انتخاب"
            className="absolute left-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-500 hover:bg-gray-100 active:bg-gray-200"
            onMouseDown={(e) => e.preventDefault()} // keep focus on input
            onClick={handleClear}
          >
            {/* simple "X" icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

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