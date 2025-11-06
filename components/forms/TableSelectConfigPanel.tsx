'use client';

import { useEffect, useState } from 'react';

type BuilderField = {
  id?: string;
  key: string;
  labelFa: string;
  type: string;
  required?: boolean;
  order?: number | null;
  config?: any;
};

type FixedInfoItem = {
  code: string;
  title: string;
  type: string;
};

export default function TableSelectConfigPanel({
  field,
  onChange,
}: {
  field: BuilderField;
  onChange: (nextConfig: any) => void;
}) {
  // Backward-compat read
  const current = (field.config?.tableSelect ?? field.config?.ct ?? {}) as {
    table?: string;
    type?: string;
  };

  const [types, setTypes] = useState<string[]>([]);
  const [fixedInfoItems, setFixedInfoItems] = useState<FixedInfoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [typeVal, setTypeVal] = useState<string>(current.type ?? '');
  const [defaultValue, setDefaultValue] = useState<string>(field.config?.defaultValue ?? '');

  // Load distinct types from fixedInformation once
  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true); setErr(null);
      try {
        const res = await fetch('/api/table-select/types?table=fixedInformation', { cache: 'no-store' });
        const j = await res.json();
        if (!res.ok || !j?.ok) throw new Error(j?.message || 'خطا در دریافت انواع');
        if (!cancel) setTypes(j.types ?? []);
      } catch (e: any) {
        if (!cancel) setErr(e?.message || 'خطای شبکه');
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, []);

  // Load fixed information items when type changes
  useEffect(() => {
    if (!typeVal) {
      setFixedInfoItems([]);
      return;
    }

    let cancel = false;
    (async () => {
      setLoadingItems(true);
      try {
        const res = await fetch(`/api/table-select/items?table=fixedInformation&type=${encodeURIComponent(typeVal)}`, { 
          cache: 'no-store' 
        });
        const j = await res.json();
        if (!res.ok || !j?.ok) throw new Error(j?.message || 'خطا در دریافت آیتم‌ها');
        if (!cancel) {
          setFixedInfoItems(j.items ?? []);
        }
      } catch (e: any) {
        if (!cancel) setErr(e?.message || 'خطای شبکه');
      } finally {
        if (!cancel) setLoadingItems(false);
      }
    })();
    return () => { cancel = true; };
  }, [typeVal]);

  // Persist normalized config whenever type or defaultValue changes
  useEffect(() => {
    onChange({
      ...field.config,
      tableSelect: {
        table: 'fixedInformation',
        type: typeVal || undefined,
      },
      defaultValue: defaultValue || undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeVal, defaultValue]);

  // Reset default value when type changes (to avoid invalid defaults)
  useEffect(() => {
    if (typeVal && defaultValue) {
      const currentItem = fixedInfoItems.find(item => item.code === defaultValue);
      if (!currentItem) {
        setDefaultValue('');
      }
    }
  }, [typeVal, defaultValue, fixedInfoItems]);

  const filteredItems = fixedInfoItems.filter(item => 
    !typeVal || item.type === typeVal
  );

  return (
    <div className="mt-4 border-t pt-4 space-y-3" dir="rtl">
      <h4 className="font-semibold text-sm">تنظیمات «انتخاب از جدول»</h4>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm mb-1">جدول</label>
          <input
            className="w-full rounded-md border px-3 py-2 font-mono bg-gray-50"
            value="fixedInformation"
            readOnly
            dir="ltr"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm mb-1">نوع (type)</label>
          <select
            className="w-full rounded-md border px-3 py-2"
            dir="ltr"
            value={typeVal}
            onChange={(e) => setTypeVal(e.target.value)}
            disabled={loading || !!err}
          >
            <option value="">— انتخاب کنید —</option>
            {types.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          {loading && <p className="mt-1 text-xs text-gray-500">در حال بارگذاری انواع…</p>}
          {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
          {!typeVal && !loading && !err && (
            <p className="mt-1 text-xs text-amber-600">
              مقدار <b>type</b> الزامی است؛ فهرست بر اساس آن از جدول «fixedInformation» فیلتر می‌شود.
            </p>
          )}
        </div>
      </div>

      {/* Default Value Configuration */}
      <div className="border-t pt-4">
        <h5 className="font-semibold text-sm mb-2">مقدار پیش‌فرض</h5>
        
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="block text-sm mb-1">انتخاب مقدار پیش‌فرض</label>
            <select
              className="w-full rounded-md border px-3 py-2"
              dir="rtl"
              value={defaultValue}
              onChange={(e) => setDefaultValue(e.target.value)}
              disabled={!typeVal || loadingItems}
            >
              <option value="">— بدون پیش‌فرض —</option>
              {filteredItems.map(item => (
                <option key={item.code} value={item.code}>
                  {item.title} ({item.code})
                </option>
              ))}
            </select>
            
            {!typeVal && (
              <p className="mt-1 text-xs text-amber-600">
                برای انتخاب مقدار پیش‌فرض، ابتدا نوع (type) را انتخاب کنید.
              </p>
            )}
            
            {typeVal && loadingItems && (
              <p className="mt-1 text-xs text-gray-500">در حال بارگذاری آیتم‌ها…</p>
            )}
            
            {typeVal && !loadingItems && filteredItems.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">
                هیچ آیتمی برای نوع انتخاب شده یافت نشد.
              </p>
            )}
            
            {defaultValue && (
              <p className="mt-1 text-xs text-green-600">
                مقدار پیش‌فرض تنظیم شد: {filteredItems.find(item => item.code === defaultValue)?.title}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}