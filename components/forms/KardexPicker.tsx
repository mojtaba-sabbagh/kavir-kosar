'use client';
import { useEffect, useRef, useState } from 'react';

type KardexItem = { id: string; code: string; nameFa: string; unit?: string | null };

export default function KardexPicker({
  label,
  value,
  onSelect, // <-- use onSelect, not onChange
}: {
  label: string;
  value: string;
  onSelect: (it: KardexItem) => void;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<KardexItem[]>([]);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  async function search(v: string) {
    setQ(v);
    if (!v) { setItems([]); return; }
    const res = await fetch('/api/kardex/search?q=' + encodeURIComponent(v), { cache: 'no-store' });
    const j = await res.json().catch(() => ({ items: [] }));
    setItems(j.items ?? []);
    setOpen(true);
  }

  return (
    <div className="relative" ref={boxRef}>
      <input
        className="w-full rounded-md border px-3 py-2"
        placeholder={label}
        dir="rtl"
        value={q}
        onChange={e => search(e.target.value)}
        onFocus={() => { if (items.length) setOpen(true); }}
      />
      {open && items.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-md border bg-white shadow">
          {items.map(it => (
            <li
              key={it.id}
              className="px-3 py-2 hover:bg-blue-50 cursor-pointer flex items-center justify-between"
              onClick={() => {
                onSelect(it);              // <-- call onSelect
                setQ(`${it.code} — ${it.nameFa}`);
                setOpen(false);
              }}
              dir="rtl"
            >
              <span>{it.nameFa}</span>
              <span className="text-xs text-gray-500 font-mono ltr">{it.code}</span>
            </li>
          ))}
        </ul>
      )}
      {value && <div className="mt-1 text-xs text-gray-500 font-mono ltr">{value}</div>}
    </div>
  );
}
