// app/admin/forms/[id]/builder/form-builder.tsx

'use client';

import { useEffect, useState } from 'react';
import FormReportConfig, { ReportConfig } from '@/components/reports/FormReportConfig';
import TableSelectConfigPanel from '@/components/forms/TableSelectConfigPanel';

type AllFormLite = { code: string; titleFa: string };
type FormFieldDefinition = { key: string; labelFa: string; type: string };

// --- Add this helper function to fetch form fields ---
async function fetchFormFields(formCode: string): Promise<FormFieldDefinition[]> {
  try {
    const res = await fetch(`/api/forms/by-code/${encodeURIComponent(formCode)}?include=fields`);
    if (!res.ok) throw new Error('Failed to fetch form fields');
    const { form } = await res.json();
    return (form?.fields || []).map((f: any) => ({
      key: f.key,
      labelFa: f.labelFa,
      type: f.type
    }));
  } catch (error) {
    console.error(`Failed to fetch fields for form ${formCode}:`, error);
    return [];
  }
}

// --- Subform config panel for 'subform' fields ---
function SubformConfigPanel({
  field,
  allForms,
  currentFormCode,
  onChange,
}: {
  field: BuilderField;
  allForms: AllFormLite[];
  currentFormCode: string;
  onChange: (nextConfig: any) => void;
}) {
  const cfg = field.config ?? {};
  const subformCode: string = cfg.subformCode ?? '';

  const setCfg = (patch: Partial<typeof cfg>) => {
    onChange({
      ...cfg,
      ...patch,
    });
  };

  // Filter out the current form to prevent self-reference
  const availableForms = allForms.filter(f => f.code !== currentFormCode);

  return (
    <div className="mt-4 border-t pt-4 space-y-3 text-black" dir="rtl">
      <h4 className="font-semibold text-sm">تنظیمات فرم تکرارشونده</h4>

      <label className="block text-sm">
        کد فرم
        <select
          className="mt-1 w-full rounded-md border px-2 py-1"
          value={subformCode}
          onChange={(e) => setCfg({ subformCode: e.target.value })}
        >
          <option value="">— انتخاب فرم —</option>
          {availableForms.map((form) => (
            <option key={form.code} value={form.code}>
              {form.titleFa} ({form.code})
            </option>
          ))}
        </select>
      </label>

      {!subformCode && (
        <p className="text-xs text-amber-600">
          برای فرم تکرارشونده، انتخاب «کد فرم» ضروری است. فیلدهای فرم انتخاب‌شده به‌عنوان ردیف‌های تکرار استفاده خواهند شد.
        </p>
      )}
    </div>
  );
}

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
  { v: 'subform', t: 'فرم تکرارشونده' },
];

// --- Add this component for entryRef configuration ---
function EntryRefConfigPanel({
  field,
  allForms,
  formFieldsCache,
  onFetchFormFields,
  onChange, // ADD THIS PROP
}: {
  field: BuilderField;
  allForms: AllFormLite[];
  formFieldsCache: Record<string, FormFieldDefinition[]>;
  onFetchFormFields: (formCode: string) => Promise<void>;
  onChange: (nextConfig: any) => void; // ADD THIS
}) {
  const cfg = field.config ?? {};
  const allowedFormCodes: string[] = Array.isArray(cfg.allowedFormCodes) ? cfg.allowedFormCodes : [];
  const displayFields: string[] = Array.isArray(cfg.displayFields) ? cfg.displayFields : ['titleFa'];

  const setCfg = (patch: Partial<typeof cfg>) => {
    onChange({
      ...cfg,
      ...patch,
    });
  };

  // Get all available fields from selected forms
  const allAvailableFields: FormFieldDefinition[] = [];
  allowedFormCodes.forEach(formCode => {
    const fields = formFieldsCache[formCode] || [];
    allAvailableFields.push(...fields);
  });

  // Remove duplicates (fields with same key)
  const uniqueFields = Array.from(
    new Map(allAvailableFields.map(field => [field.key, field])).values()
  );

  // Get form name for display
  const getFormName = (formCode: string) => {
    const form = allForms.find(f => f.code === formCode);
    return form ? `${form.titleFa} (${form.code})` : formCode;
  };

  // Handle form selection change
  const handleAllowedFormsChange = async (selectedCodes: string[]) => {
    setCfg({ allowedFormCodes: selectedCodes });
    
    // Fetch fields for newly selected forms that aren't in cache
    for (const formCode of selectedCodes) {
      if (!formFieldsCache[formCode]) {
        await onFetchFormFields(formCode);
      }
    }
  };

  return (
    <div className="mt-3 space-y-4">
      <div>
        <label className="block text-sm mb-1">فرم‌های مجاز برای ارجاع</label>
        <select
          multiple
          className="w-full border rounded-md px-3 py-2"
          dir="rtl"
          value={allowedFormCodes}
          onChange={(e) => {
            const selected = Array.from(e.target.selectedOptions).map(o => o.value);
            handleAllowedFormsChange(selected);
          }}
        >
          {allForms.map(af => (
            <option key={af.code} value={af.code}>
              {af.titleFa} ({af.code})
            </option>
          ))}
        </select>
        <div className="text-xs text-gray-500 mt-1">
          برای انتخاب چندگانه، کلید Ctrl (یا Cmd در Mac) را نگه دارید
        </div>
      </div>

      {/* Display selected forms with their fields */}
      {allowedFormCodes.length > 0 && (
        <div className="bg-gray-50 rounded-md p-3">
          <div className="text-sm font-medium mb-2">فرم‌های انتخاب شده:</div>
          <div className="space-y-2">
            {allowedFormCodes.map(formCode => {
              const fields = formFieldsCache[formCode] || [];
              const isLoading = !formFieldsCache[formCode];
              
              return (
                <div key={formCode} className="border rounded p-2">
                  <div className="font-medium text-sm">
                    {getFormName(formCode)}
                    {isLoading && <span className="text-xs text-gray-500 mr-2"> (در حال بارگذاری...)</span>}
                  </div>
                  {fields.length > 0 ? (
                    <div className="text-xs text-gray-600 mt-1">
                      فیلدهای موجود: {fields.map(f => f.labelFa).join('، ')}
                    </div>
                  ) : !isLoading && (
                    <div className="text-xs text-gray-500 mt-1">فیلدی یافت نشد</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Display field selection */}
      {uniqueFields.length > 0 && (
        <div>
          <label className="block text-sm mb-1">فیلدها برای نمایش و جستجو</label>
          <select
            multiple
            className="w-full border rounded-md px-3 py-2"
            value={displayFields}
            onChange={(e) => {
              const selected = Array.from(e.target.selectedOptions).map(o => o.value);
              setCfg({ displayFields: selected });
            }}
          >
            {/* Always include common fields */}
            <option value="id">شناسه (id)</option>
            <option value="titleFa">عنوان (titleFa)</option>
            <option value="code">کد (code)</option>
            
            {/* Dynamic fields from selected forms */}
            {uniqueFields
              .filter(f => !['id', 'titleFa', 'code'].includes(f.key)) // Don't duplicate common fields
              .map(field => (
                <option key={field.key} value={field.key}>
                  {field.labelFa} ({field.key}) - {field.type}
                </option>
              ))}
          </select>
          <div className="text-xs text-gray-500 mt-1">
            فیلدهایی که باید نمایش داده شوند (با خط تیره جدا می‌شوند)
          </div>
          <div className="text-xs text-gray-500">
            جستجو در همه فیلدهای انتخاب شده انجام می‌شود
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm mb-1">برچسب رابطه (اختیاری)</label>
        <input
          className="w-full border rounded-md px-3 py-2"
          value={cfg.relation ?? ''}
          onChange={(e) => setCfg({ relation: e.target.value })}
          placeholder="مثلا: محصول مرتبط، مشتری، etc."
        />
      </div>
    </div>
  );
}

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
  // Ensure all fields have a config object (never undefined)
  const [fields, setFields] = useState<Field[]>(initialFields.map(f => ({
    ...f,
    config: f.config ?? {}
  })));
  const [reportCfg, setReportCfg] = useState<ReportConfig>(initialReportConfig);
  const [msg, setMsg] = useState<string|null>(null);
  const [err, setErr] = useState<string|null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // Add state for form fields cache
  const [formFieldsCache, setFormFieldsCache] = useState<Record<string, FormFieldDefinition[]>>({});

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

  // Function to fetch and cache form fields
  const fetchAndCacheFormFields = async (formCode: string) => {
    if (formFieldsCache[formCode]) return; // Already cached
    
    const fields = await fetchFormFields(formCode);
    setFormFieldsCache(prev => ({
      ...prev,
      [formCode]: fields
    }));
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
              <FieldConfigPanel field={f} updateField={updateField} idx={idx} />
              {['select', 'multiselect'].includes(f.type) && (
                <OptionsEditor idx={idx} field={f} updateField={updateField} />
              )}

              {['entryRef', 'entryRefMulti'].includes(f.type) && (
                  <EntryRefConfigPanel
                    field={f}
                    allForms={allForms}
                    formFieldsCache={formFieldsCache}
                    onFetchFormFields={fetchAndCacheFormFields}
                    onChange={(nextConfig) => updateField(idx, { config: nextConfig })}
                  />
                )}

              {f.type === 'kardexItem' && (
                <KardexConfigPanel
                  field={f}
                  allFields={fields}
                  onChange={(nextConfig) => updateField(idx, { config: nextConfig })}
                />
              )}
              {f.type === 'subform' && (
                <SubformConfigPanel
                  field={f}
                  allForms={allForms}
                  currentFormCode={form.code}
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

// default value inputs for each field type

function FieldConfigPanel({ field, updateField, idx }: {
  field: Field;
  updateField: (i: number, p: Partial<Field>) => void;
  idx: number;
}) {
  const cfg = field.config ?? {};
  
  const setConfig = (patch: any) => {
    updateField(idx, { config: { ...cfg, ...patch } });
  };

  const renderDefaultValueInput = () => {
    switch (field.type) {
      case 'text':
      case 'textarea':
        return (
          <div>
            <label className="block text-sm mb-1">مقدار پیش‌فرض</label>
            <input
              className="w-full border rounded-md px-3 py-2"
              value={cfg.defaultValue ?? ''}
              onChange={(e) => setConfig({ defaultValue: e.target.value })}
              placeholder="مقدار پیش‌فرض"
            />
          </div>
        );

      case 'number':
        return (
          <div>
            <label className="block text-sm mb-1">مقدار پیش‌فرض</label>
            <input
              type="number"
              className="w-full border rounded-md px-3 py-2"
              dir="ltr"
              value={cfg.defaultValue ?? ''}
              onChange={(e) => setConfig({ 
                defaultValue: e.target.value === '' ? undefined : Number(e.target.value) 
              })}
              placeholder="عدد پیش‌فرض"
            />
          </div>
        );

      case 'date':
      case 'datetime':
        return (
          <div>
            <label className="block text-sm mb-1">مقدار پیش‌فرض</label>
            <select
              className="w-full border rounded-md px-3 py-2"
              value={cfg.defaultValue ?? ''}
              onChange={(e) => setConfig({ defaultValue: e.target.value || undefined })}
            >
              <option value="">— بدون پیش‌فرض —</option>
              <option value="now">زمان حال</option>
              <option value="today">امروز</option>
            </select>
          </div>
        );

      case 'checkbox':
        return (
          <label className="flex items-center gap-2 mt-3">
            <input
              type="checkbox"
              checked={!!cfg.defaultValue}
              onChange={(e) => setConfig({ defaultValue: e.target.checked })}
            />
            <span>فعال به عنوان پیش‌فرض</span>
          </label>
        );

      case 'select':
        return (
          <div>
            <label className="block text-sm mb-1">مقدار پیش‌فرض</label>
            <select
              className="w-full border rounded-md px-3 py-2"
              value={cfg.defaultValue ?? ''}
              onChange={(e) => setConfig({ defaultValue: e.target.value || undefined })}
            >
              <option value="">— انتخاب کنید —</option>
              {(cfg.options ?? []).map((opt: any) => (
                <option key={String(opt.value)} value={String(opt.value)}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        );

      case 'multiselect':
      case 'entryRefMulti':
        return (
          <div>
            <label className="block text-sm mb-1">مقادیر پیش‌فرض</label>
            <input
              className="w-full border rounded-md px-3 py-2"
              value={Array.isArray(cfg.defaultValue) ? cfg.defaultValue.join(', ') : ''}
              onChange={(e) => {
                const value = e.target.value;
                // Convert comma-separated string to array
                const arr = value.split(',').map(v => v.trim()).filter(v => v);
                setConfig({ defaultValue: arr });
              }}
              placeholder="مقادیر با کاما جدا شوند (value1, value2, ...)"
            />
            <div className="text-xs text-gray-500 mt-1">
              {field.type === 'entryRefMulti' 
                ? 'شناسه‌های ورودی را با کاما جدا کنید' 
                : 'مقادیر را با کاما جدا کنید'}
            </div>
          </div>
        );

      case 'entryRef':
        return (
          <div>
            <label className="block text-sm mb-1">مقدار پیش‌فرض (ID ورودی)</label>
            <input
              className="w-full border rounded-md px-3 py-2"
              value={cfg.defaultValue ?? ''}
              onChange={(e) => setConfig({ defaultValue: e.target.value })}
              placeholder="شناسه ورودی (ID)"
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="mt-3 border-t pt-3">
      <h4 className="font-semibold text-sm mb-2">تنظیمات پیش‌فرض</h4>
      {renderDefaultValueInput()}
    </div>
  );
}