'use client';

type BuilderField = {
  id?: string;
  key: string;
  labelFa: string;
  type: string;
  required?: boolean;
  order?: number | null;
  config?: any;
};

export default function ctConfigPanel({
  field,
  onChange,
}: {
  field: BuilderField;
  onChange: (nextConfig: any) => void;
}) {
  const cfg = field.config ?? {};
  const tcfg = cfg.ct ?? {};
  const tableName = tcfg.table ?? 'FixedInformation'; // default to your fixtures table
  const type = tcfg.type ?? '';

  const setCfg = (patch: Partial<typeof tcfg>) => {
    onChange({ ...cfg, ct: { ...tcfg, ...patch } });
  };

  return (
    <div className="mt-4 border-t pt-4 space-y-3" dir="rtl">
      <h4 className="font-semibold text-sm">تنظیمات انتخاب از جدول</h4>

      <label className="block text-sm">
        نام جدول
        <select
          className="mt-1 w-full rounded-md border px-2 py-1"
          value={tableName}
          onChange={e => setCfg({ table: e.target.value })}
        >
          {/* اگر در آینده جداول بیشتری اضافه کردید، اینجا لیست کنید */}
          <option value="FixedInformation">اطلاعات ثابت (FixedInformation)</option>
        </select>
      </label>

      <label className="block text-sm">
        نوع (Type) برای فیلتر
        <input
          className="mt-1 w-full rounded-md border px-2 py-1"
          placeholder="مثلاً: units, categories, ..."
          value={type}
          onChange={e => setCfg({ type: e.target.value })}
        />
      </label>

      <p className="text-xs text-gray-500">
        داده‌های این فیلد از جدول انتخاب‌شده با فیلتر نوع (type) بارگذاری می‌شود. «کد» ذخیره می‌گردد، «عنوان» نمایش داده می‌شود.
      </p>
    </div>
  );
}
