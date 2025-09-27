'use client';

import { useEffect, useState } from 'react';
import FormReportConfig, { ReportConfig } from '@/components/reports/FormReportConfig';
import TableSelectConfigPanel from '@/components/forms/TableSelectConfigPanel';

type AllFormLite = { code: string; titleFa: string };
// --- Kardex config panel for 'kardexItem' fields ---
type BuilderField = {
  id?: string;
  key: string;
  labelFa: string;
  type: string; // 'kardexItem' | 'number' | ...
  required?: boolean;
  order?: number | null;
  config?: any;
};

function KardexConfigPanel({
  field,
  allFields,
  onChange,
}: {
  field: BuilderField;
  allFields: BuilderField[];
  onChange: (nextConfig: any) => void;
}) {
  const cfg = field.config ?? {};
  const kcfg = cfg.kardex ?? {};
  const amountKey: string = kcfg.amountKey ?? '';
  const op: 'deltaPlus' | 'deltaMinus' | 'set' = kcfg.op ?? 'deltaPlus';
  const applyOn: 'final' | 'anyConfirm' = kcfg.applyOn ?? 'final';

  // Allowed numeric fields to pair with this picker
  const numericFields = allFields.filter((f) => f.type === 'number');

  const setCfg = (patch: Partial<typeof kcfg>) => {
    onChange({
      ...cfg,
      kardex: { ...kcfg, ...patch },
    });
  };

  return (
    <div className="mt-4 border-t pt-4 space-y-3 text-black" dir="rtl">
      <h4 className="font-semibold text-sm">تنظیمات کاردکس</h4>

      <label className="block text-sm">
        فیلد مقدار مرتبط
        <select
          className="mt-1 w-full rounded-md border px-2 py-1"
          value={amountKey}
          onChange={(e) => setCfg({ amountKey: e.target.value })}
        >
          <option value="">— انتخاب کنید —</option>
          {numericFields.map((nf) => (
            <option key={nf.key} value={nf.key}>
              {nf.labelFa} ({nf.key})
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        نوع عملیات
        <select
          className="mt-1 w-full rounded-md border px-2 py-1"
          value={op}
          onChange={(e) => setCfg({ op: e.target.value as any })}
        >
          <option value="deltaPlus">افزایش (delta+)</option>
          <option value="deltaMinus">کاهش (delta−)</option>
          <option value="set">تنظیم موجودی (set)</option>
        </select>
      </label>

      <label className="block text-sm">
        زمان اعمال
        <select
          className="mt-1 w-full rounded-md border px-2 py-1"
          value={applyOn}
          onChange={(e) => setCfg({ applyOn: e.target.value as any })}
        >
          <option value="final">در تأیید نهایی</option>
          <option value="anyConfirm">در هر تأیید</option>
        </select>
      </label>

      {!amountKey && (
        <p className="text-xs text-amber-600">
          برای اعمال تغییر موجودی، انتخاب «فیلد مقدار مرتبط» ضروری است.
        </p>
      )}
    </div>
  );
}

// --- Form types ---
type Field = {
  id?: string;
  key: string;
  labelFa: string;
  type: string;
  required: boolean;
  order: number;
  config: any;
};
type FormInfo = { id: string; code: string; titleFa: string; isActive: boolean; sortOrder: number; version: number };


const FIELD_TYPES = [
  { v: 'text', t: 'متن' },
  { v: 'textarea', t: 'چندخطی' },
  { v: 'number', t: 'عدد' },
  { v: 'date', t: 'تاریخ' },
  { v: 'datetime', t: 'تاریخ‌زمان' },
  { v: 'select', t: 'انتخابی' },
  { v: 'multiselect', t: 'انتخاب‌های متعدد' },
  { v: 'checkbox', t: 'بله/خیر' },
  { v: 'file', t: 'فایل' },
  { v: 'entryRef', t: 'ارجاع به فرم' },
  { v: 'entryRefMulti', t: 'ارجاع‌های متعدد' },
  { v: 'kardexItem', t: 'کاردکس کالا' },
  { v: 'tableSelect', t: 'انتخاب از جدول' },
  { v: 'group', t: 'گروه تکرارشونده' },
];

export default function FormBuilder({
  form: initialForm,
  fields: initialFields,
  initialReportConfig,
  allForms,
}:{
  form: FormInfo;
  fields: Field[];
  initialReportConfig: ReportConfig;
  allForms: AllFormLite[];
}) {
  const [form, setForm] = useState(initialForm);
  const [fields, setFields] = useState<Field[]>(initialFields);
  const [reportCfg, setReportCfg] = useState<ReportConfig>(initialReportConfig);
  const [msg, setMsg] = useState<string|null>(null);
  const [err, setErr] = useState<string|null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const deleteForm = async () => {
    if (!confirm('آیا از حذف این فرم مطمئن هستید؟')) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/forms/${form.id}`, { method: 'DELETE' });
      if (res.ok) window.location.href = '/admin/forms';
      else {
        const j = await res.json().catch(() => ({}));
        setErr(j.message || 'خطا در حذف فرم');
      }
    } finally {
      setDeleting(false);
    }
  };

  const addField = () => {
    const i = fields.length + 1;
    setFields(prev => [...prev, { key: `field_${i}`, labelFa: `فیلد ${i}`, type: 'text', required: false, order: i*10, config: {} }]);
  };
  const removeField = (idx:number) => setFields(prev => prev.filter((_,i)=>i!==idx));
  const updateField = (idx:number, patch: Partial<Field>) => {
    setFields(prev => prev.map((f,i)=> i===idx ? { ...f, ...patch } : f));
  };

  const saveForm = async () => {
    setSaving(true); setMsg(null); setErr(null);
    try {
      // 1) Save form meta
      const res1 = await fetch(`/api/admin/forms/${form.id}`, {
        method: 'PUT', headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ titleFa: form.titleFa, isActive: form.isActive, sortOrder: form.sortOrder })
      });
      if (!res1.ok) throw new Error((await res1.json().catch(()=>({}))).message || 'خطا در ذخیره فرم');

      // (optional) the PUT may call ensureReportForForm server-side; if not, keep step 2/2.5

      // 2) Save fields (bulk upsert)
      const res2 = await fetch(`/api/admin/forms/${form.id}/fields`, {
        method: 'POST', headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ fields })
      });
      if (!res2.ok) throw new Error((await res2.json().catch(()=>({}))).message || 'خطا در ذخیره فیلدها');

      // 3) Save report config (single source of truth)
      const res3 = await fetch(`/api/admin/forms/${form.id}/report-config`, {
        method: 'PUT', headers: { 'Content-Type':'application/json' },
        body: JSON.stringify(reportCfg),
      });
      if (!res3.ok) throw new Error((await res3.json().catch(()=>({}))).message || 'خطا در ذخیره تنظیمات گزارش');

      setMsg('همه تغییرات با موفقیت ذخیره شد');
    } catch (e:any) {
      setErr(e?.message || 'خطا در ذخیره');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Form meta */}
      <div className="rounded-xl border bg-white p-4 space-y-3">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-60">
            <label className="block text-sm mb-1">کد فرم</label>
            <input className="w-full border rounded-md px-3 py-2 font-mono bg-gray-50" value={form.code} readOnly dir="ltr" />
          </div>
          <div className="flex-1 min-w-60">
            <label className="block text-sm mb-1">عنوان</label>
            <input className="w-full border rounded-md px-3 py-2" value={form.titleFa} onChange={e=>setForm({...form, titleFa: e.target.value})} />
          </div>
          <div className="w-32">
            <label className="block text-sm mb-1">ترتیب</label>
            <input type="number" className="w-full border rounded-md px-3 py-2" dir="ltr" value={form.sortOrder} onChange={e=>setForm({...form, sortOrder: Number(e.target.value||0)})} />
          </div>
          <label className="flex items-end gap-2">
            <input type="checkbox" checked={form.isActive} onChange={e=>setForm({...form, isActive: e.target.checked})} />
            <span>فعال</span>
          </label>
        </div>
      </div>

      {/* Fields editor */}
      <div className="rounded-xl border bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">فیلدها</h2>
          <button onClick={addField} className="rounded-md border px-3 py-1 hover:bg-gray-50">افزودن فیلد</button>
        </div>

        <div className="space-y-4">
          {fields.map((f, idx) => (
            <div key={idx} className="rounded-lg border p-3">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div>
                  <label className="block text-sm mb-1">کلید</label>
                  <input
                    className="w-full border rounded-md px-3 py-2 font-mono"
                    dir="ltr"
                    value={f.key}
                    onChange={(e) => updateField(idx, { key: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">برچسب</label>
                  <input
                    className="w-full border rounded-md px-3 py-2"
                    value={f.labelFa}
                    onChange={(e) =>
                      updateField(idx, { labelFa: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">نوع</label>
                  <select
                    className="w-full border rounded-md px-3 py-2"
                    value={f.type}
                    onChange={(e) => updateField(idx, { type: e.target.value })}
                  >
                    {FIELD_TYPES.map((t) => (
                      <option key={t.v} value={t.v}>
                        {t.t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1">ترتیب</label>
                  <input
                    type="number"
                    className="w-full border rounded-md px-3 py-2"
                    dir="ltr"
                    value={f.order}
                    onChange={(e) =>
                      updateField(idx, {
                        order: Number(e.target.value || 0),
                      })
                    }
                  />
                </div>
                <label className="flex items-end gap-2">
                  <input
                    type="checkbox"
                    checked={!!f.required}
                    onChange={(e) =>
                      updateField(idx, { required: e.target.checked })
                    }
                  />
                  <span>الزامی</span>
                </label>
              </div>

              {/* Simple config editor */}
              {['number'].includes(f.type) && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm mb-1">حداقل</label>
                    <input
                      type="number"
                      className="w-full border rounded-md px-3 py-2"
                      dir="ltr"
                      value={f.config?.min ?? ''}
                      onChange={(e) =>
                        updateField(idx, {
                          config: {
                            ...f.config,
                            min:
                              e.target.value === ''
                                ? undefined
                                : Number(e.target.value),
                          },
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">حداکثر</label>
                    <input
                      type="number"
                      className="w-full border rounded-md px-3 py-2"
                      dir="ltr"
                      value={f.config?.max ?? ''}
                      onChange={(e) =>
                        updateField(idx, {
                          config: {
                            ...f.config,
                            max:
                              e.target.value === ''
                                ? undefined
                                : Number(e.target.value),
                          },
                        })
                      }
                    />
                  </div>
                  <label className="flex items-end gap-2">
                    <input
                      type="checkbox"
                      checked={!!f.config?.decimals}
                      onChange={(e) =>
                        updateField(idx, {
                          config: { ...f.config, decimals: e.target.checked },
                        })
                      }
                    />
                    <span>اعداد اعشاری</span>
                  </label>
                </div>
              )}

              {['select', 'multiselect'].includes(f.type) && (
                <OptionsEditor idx={idx} field={f} updateField={updateField} />
              )}

              {['entryRef', 'entryRefMulti'].includes(f.type) && (
                <div className="mt-3 space-y-2">
                  <label className="block text-sm">فرم‌های مجاز برای ارجاع</label>

                  <select
                    multiple
                    className="w-full border rounded-md px-3 py-2"
                    dir="rtl"
                    value={Array.isArray(f.config?.allowedFormCodes) ? f.config.allowedFormCodes : []}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions).map(o => o.value);
                      updateField(idx, { config: { ...(f.config ?? {}), allowedFormCodes: selected } });
                    }}
                  >
                    {allForms.map(af => (
                      <option key={af.code} value={af.code}>
                        {af.titleFa} ({af.code})
                      </option>
                    ))}
                  </select>

                  <label className="block text-sm mt-2 mb-1">برچسب رابطه (اختیاری)</label>
                  <input
                    className="w-full border rounded-md px-3 py-2"
                    value={f.config?.relation ?? ''}
                    onChange={(e) =>
                      updateField(idx, { config: { ...(f.config ?? {}), relation: e.target.value } })
                    }
                  />
                </div>
              )}
              {f.type === 'kardexItem' && (
                <KardexConfigPanel
                  field={f}
                  allFields={fields}
                  onChange={(nextConfig) => updateField(idx, { config: nextConfig })}
                />
              )}

            {f.type === 'tableSelect' && (
              <TableSelectConfigPanel
                field={f}
                onChange={(nextConfig) => updateField(idx, { config: nextConfig })}
              />
              
              )}

              <div className="mt-3 text-left">
                <button onClick={()=>removeField(idx)} type="button" className="text-red-600 text-sm hover:underline">حذف فیلد</button>
              </div>
            </div>
          ))}
        </div>

        {/* Report settings (controlled; no Save inside) */}
        <FormReportConfig fields={fields} value={reportCfg} onChange={setReportCfg} />
  
        {/* Single Save & Delete */}
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={saveForm}
            disabled={saving}
            className="rounded-md bg-blue-600 text-white px-4 py-2 disabled:opacity-50"
          >
            {saving ? 'در حال ذخیره…' : 'ذخیره'}
          </button>
  
          <button
            onClick={deleteForm}
            disabled={deleting}
            className="rounded-md bg-red-600 text-white px-4 py-2 disabled:opacity-50"
          >
            {deleting ? 'در حال حذف…' : 'حذف فرم'}
          </button>

        {msg && <span className="text-green-600 text-sm">{msg}</span>}
        {err && <span className="text-red-600 text-sm">{err}</span>}
      </div>
    </div>
  </div>
  );
}

function OptionsEditor({
  idx,
  field,
  updateField,
}: {
  idx: number;
  field: Field;
  updateField: (i: number, p: Partial<Field>) => void;
}) {
  const opts: { value: string; label: string }[] = field.config?.options ?? [];
  const setOpts = (arr: any[]) =>
    updateField(idx, { config: { ...field.config, options: arr } });

  const add = () =>
    setOpts([
      ...(opts || []),
      { value: `val_${(opts?.length || 0) + 1}`, label: `گزینه ${(
        opts?.length || 0
      ) + 1}` },
    ]);
  const del = (i: number) => setOpts(opts.filter((_, x) => x !== i));
  const upd = (i: number, k: 'value' | 'label', v: string) =>
    setOpts(opts.map((o, x) => (x === i ? { ...o, [k]: v } : o)));

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm">گزینه‌ها</label>
        <button
          type="button"
          onClick={add}
          className="rounded-md border px-3 py-1 hover:bg-gray-50"
        >
          افزودن گزینه
        </button>
      </div>
      <div className="mt-2 space-y-2">
        {opts?.map((o, i) => (
          <div key={i} className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input
              className="border rounded-md px-3 py-2 font-mono"
              dir="ltr"
              value={o.value}
              onChange={(e) => upd(i, 'value', e.target.value)}
              placeholder="value"
            />
            <input
              className="border rounded-md px-3 py-2"
              value={o.label}
              onChange={(e) => upd(i, 'label', e.target.value)}
              placeholder="label"
            />
            <div className="text-left">
              <button
                type="button"
                onClick={() => del(i)}
                className="text-xs text-red-600 hover:underline"
              >
                حذف
              </button>
            </div>
          </div>
        ))}
        {(!opts || opts.length === 0) && (
          <div className="text-xs text-gray-500">گزینه‌ای تعریف نشده است</div>
        )}
      </div>
    </div>
  );
}
