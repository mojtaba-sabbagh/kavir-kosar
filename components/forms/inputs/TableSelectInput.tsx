'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Props = {
  label: string;
  value: string;
  currentTitle?: string; // cached title when the option isn't in the first page
  onChange: (val: string, optionalTitle?: string) => void;
  config: { table?: string; type?: string; defaultValue?: string };
};

export default function TableSelectInput({ label, value, currentTitle, onChange, config }: Props) {
  const table = (config?.table || 'fixedInformation').trim();
  const type  = (config?.type  || '').trim();
  const defaultValue = config?.defaultValue || '';

  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [opts, setOpts] = useState<{ value: string; label: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);

  const mounted = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    p.set('table', table);
    if (type) p.set('type', type);
    if (q) p.set('q', q);
    p.set('limit', '100');
    return `?${p.toString()}`;
  }, [table, type, q]);

  // Load options when component mounts or when dependencies change
  useEffect(() => {
    if (!mounted.current) {
      // Initial load - check if we need to set default value
      mounted.current = true;
      
      if (defaultValue && !value) {
        // Load the default value item specifically
        loadDefaultValueItem();
      } else {
        // Normal initial load
        loadOptions();
      }
    } else {
      // Subsequent loads when search changes
      loadOptions();
    }
  }, [open, qs]);

  const loadOptions = async () => {
    if (!open && !initialLoad) return;
    
    let cancel = false;
    setLoading(true); 
    setErr(null);
    try {
      const res = await fetch(`/api/table-select${qs}`, { cache: 'no-store' });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.message || 'خطا در دریافت اطلاعات');
      if (!cancel) {
        setOpts(j.options || []);
        setInitialLoad(false);
      }
    } catch (e: any) {
      if (!cancel) setErr(e?.message || 'خطا');
    } finally {
      if (!cancel) setLoading(false);
    }
  };

  const loadDefaultValueItem = async () => {
    if (!defaultValue) return;
    
    setLoading(true);
    setErr(null);
    try {
      // First, try to load the specific default value item
      const itemRes = await fetch(`/api/fixed-info/${defaultValue}`);
      if (itemRes.ok) {
        const itemData = await itemRes.json();
        if (itemData.ok && itemData.item) {
          // Set the default value in the form
          onChange(defaultValue, itemData.item.title);
          
          // Also load the full list for the dropdown
          const listRes = await fetch(`/api/table-select${qs}`, { cache: 'no-store' });
          const listData = await listRes.json();
          if (listRes.ok && listData.ok) {
            setOpts(listData.options || []);
          }
        }
      }
    } catch (e: any) {
      console.warn('Could not load default value:', e);
      // Fallback to normal load
      loadOptions();
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  };

  const selectedLabel = useMemo(() => {
    if (value) {
      const found = opts.find(o => o.value === value);
      return found?.label || currentTitle || value;
    }
    return '';
  }, [opts, value, currentTitle]);

  // Auto-open when user starts typing
  useEffect(() => {
    if (q.trim() && !open) {
      setOpen(true);
    }
  }, [q, open]);

  // Set default value when component first renders
  useEffect(() => {
    if (defaultValue && !value && !initialLoad && opts.length > 0) {
      const defaultOption = opts.find(opt => opt.value === defaultValue);
      if (defaultOption) {
        onChange(defaultValue, defaultOption.label);
      }
    }
  }, [defaultValue, value, initialLoad, opts, onChange]);

  return (
    <div className="space-y-2" dir="rtl">
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {defaultValue && !value && (
          <span className="text-xs text-green-600 mr-2"> (پیش‌فرض: {defaultValue})</span>
        )}
      </label>
      
      <div
        className="relative"
        onFocus={() => setOpen(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setOpen(false);
            setQ(''); // Clear search when closing
          }
        }}
      >
        <div className="flex gap-2">
          <input
            ref={inputRef}
            className="w-full border rounded-md px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            placeholder={open ? 'جستجو…' : (selectedLabel || label || 'انتخاب کنید…')}
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
              
              // Close on Escape
              if (e.key === 'Escape') {
                setOpen(false);
                setQ('');
              }
              
              // Navigate with arrow keys when open
              if (open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                e.preventDefault();
                // You could add keyboard navigation here
              }
            }}
          />

          {/* Clear button */}
          {value && (
            <button
              type="button"
              className="shrink-0 rounded-md border px-3 py-2 hover:bg-gray-50 transition-colors"
              onClick={() => {
                onChange('', '');
                setQ('');
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
          <div className="absolute z-10 mt-1 w-full overflow-auto rounded-md border bg-white shadow-lg max-h-64">
            {loading && (
              <div className="px-3 py-2 text-sm text-gray-500 flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                در حال جستجو…
              </div>
            )}
            
            {err && (
              <div className="px-3 py-2 text-sm text-red-600 bg-red-50">
                {err}
              </div>
            )}

            {!loading && !err && opts.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-500">
                {q ? 'نتیجه‌ای یافت نشد' : 'موردی برای نمایش وجود ندارد'}
              </div>
            )}

            {!loading && !err && opts.map((o) => (
              <button
                key={o.value}
                type="button"
                className={`block w-full text-right px-3 py-2 hover:bg-gray-50 transition-colors ${
                  o.value === value ? 'bg-blue-50 text-blue-700' : ''
                } ${
                  o.value === defaultValue && !value ? 'border-r-2 border-green-500 bg-green-50' : ''
                }`}
                onMouseDown={(e) => e.preventDefault()} // keep focus inside wrapper (prevents blur)
                onClick={() => {
                  onChange(o.value, o.label);
                  setOpen(false);
                  setQ('');
                }}
              >
                <div className="flex justify-between items-center">
                  <span>{o.label}</span>
                  <span className="text-xs text-gray-500 ltr font-mono">({o.value})</span>
                </div>
                
                {o.value === defaultValue && (
                  <div className="text-xs text-green-600 text-left mt-1">پیش‌فرض</div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}