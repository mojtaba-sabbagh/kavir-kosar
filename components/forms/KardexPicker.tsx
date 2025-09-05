'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type KardexItem = { id: string; code: string; nameFa: string; unit?: string | null };

export default function KardexPicker({
  label,
  value,
  onSelect,
}: {
  label: string;
  value: string;
  onSelect: (it: KardexItem) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<KardexItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const blurTimer = useRef<number | null>(null);

  // Keep dropdown positioned under the input (portal, fixed positioning)
  const updateRect = () => {
    if (!inputRef.current) return;
    setRect(inputRef.current.getBoundingClientRect());
  };

  useLayoutEffect(() => {
    updateRect();
    const onWin = () => updateRect();
    window.addEventListener('resize', onWin);
    window.addEventListener('scroll', onWin, true); // capture scroll in ancestors
    return () => {
      window.removeEventListener('resize', onWin);
      window.removeEventListener('scroll', onWin, true);
    };
  }, []);

  // Close when clicking outside (works on mobile too)
  useEffect(() => {
    const onDocPointerDown = (e: PointerEvent) => {
      if (!inputRef.current) return;
      const t = e.target as Node;
      // If tap happened inside the input, let focus handler reopen
      if (inputRef.current.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onDocPointerDown, { passive: true });
    return () => document.removeEventListener('pointerdown', onDocPointerDown);
  }, []);

  // Debounce helper
  function useDebounce<T>(val: T, ms = 250) {
    const [v, setV] = useState(val);
    useEffect(() => {
      const id = setTimeout(() => setV(val), ms);
      return () => clearTimeout(id);
    }, [val, ms]);
    return v;
  }
  const dq = useDebounce(q, 250);

  // Search
  useEffect(() => {
    (async () => {
      setErr(null);
      if (!dq || dq.trim().length < 1) {
        setItems([]);
        setOpen(false);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch('/api/kardex/search?q=' + encodeURIComponent(dq), { cache: 'no-store' });
        const j = await res.json().catch(() => ({}));
        const arr: KardexItem[] = (j.items ?? j.rows ?? []) as KardexItem[];
        setItems(Array.isArray(arr) ? arr : []);
        setOpen((arr?.length ?? 0) > 0); // open only if we have results
      } catch {
        setErr('خطا در جستجو');
        setItems([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    })();
  }, [dq]);

  // Blur handling for mobile: delay close so taps can register
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
        onFocus={() => { updateRect(); if (items.length > 0) setOpen(true); }}
        onBlur={scheduleClose}
        onClick={() => { updateRect(); if (items.length > 0) setOpen(true); }}
      />

      {/* Inline hints */}
      {loading && <div className="mt-1 text-xs text-gray-500">در حال جستجو…</div>}
      {err && <div className="mt-1 text-xs text-red-600">{err}</div>}
      {/*(!loading && !err && q && items.length === 0) && (
        <!--div className="mt-1 text-xs text-gray-500">نتیجه‌ای یافت نشد</div>
      )*/}
      {value && !q && <div className="mt-1 text-xs text-gray-500 font-mono ltr">{value}</div>}

      {/* Portal dropdown */}
      {open && items.length > 0 && rect && typeof window !== 'undefined' && createPortal(
        <ul
          role="listbox"
          // position under input, even with mobile keyboard & tricky containers
          style={{
            position: 'fixed',
            top: rect.bottom + window.scrollY + 4,
            left: rect.left + window.scrollX,
            width: rect.width,
            maxHeight: '16rem',
            zIndex: 10000,
          }}
          className="overflow-auto rounded-md border bg-white shadow-lg"
          onPointerDown={(e) => { e.preventDefault(); cancelScheduledClose(); }} // keep open while tapping
          onMouseDown={(e) => { e.preventDefault(); cancelScheduledClose(); }}   // Safari fallback
        >
            {items.map((it) => (
            <li
                key={it.id}
                role="option"
                tabIndex={-1}
                className="px-3 py-2 hover:bg-blue-50 cursor-pointer flex items-center justify-between pointer-events-auto"
                // Select on pointerdown so mobile never misses it
                onPointerDown={(e) => {
                e.preventDefault();            // keep focus, avoid blur
                cancelScheduledClose();        // cancel pending close
                onSelect(it);                  // <-- do the selection NOW
                setQ(`${it.nameFa} — ${it.code}`);
                setOpen(false);
                }}
                // Safari fallback (not strictly necessary after pointerdown)
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
