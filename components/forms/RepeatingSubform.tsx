'use client';

import { useState } from 'react';
import type { FormField, FieldType } from '@prisma/client';
import { isLtrField, optionLabel } from '@/lib/forms/field-utils';
import KardexPicker from './KardexPicker';
import JDatePicker from '@/components/ui/JDatePicker';
import JDateTimePicker from '@/components/ui/JDateTimePicker';
import TableSelectInput from './inputs/TableSelectInput';

type SubformInstance = Record<string, any>;

type Props = {
  label: string;
  subformFields: Pick<FormField, 'key'|'labelFa'|'type'|'required'|'config'|'order'>[];
  value: SubformInstance[]; // array of rows
  onChange: (rows: SubformInstance[]) => void;
};

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN = '۰۱۲۳۴۵۶۷۸۹';

function toEnglishDigits(s: string): string {
  if (!s) return s;
  let t = s.replace(/\u066C|,/g, '')
           .replace(/\u066B|\u060C/g, '.');
  t = t.replace(/[۰-۹]/g, d => String(PERSIAN.indexOf(d)))
       .replace(/[٠-٩]/g, d => String(ARABIC_INDIC.indexOf(d)));
  return t.trim();
}

function fmtFaTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(+d)) return String(iso);
  return new Intl.DateTimeFormat("fa-IR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function getEmptyRow(fields: Pick<FormField, 'key'|'type'|'config'>[]): SubformInstance {
  const row: SubformInstance = {};
  for (const f of fields) {
    row[f.key] = getEmptyValueForType(f.type);
  }
  return row;
}

function getEmptyValueForType(type: string): any {
  switch (type) {
    case 'multiselect':
      return [];
    case 'checkbox':
      return false;
    case 'number':
      return '';
    case 'tableSelect':
    case 'kardexItem':
      return '';
    default:
      return '';
  }
}

export default function RepeatingSubform({ label, subformFields, value, onChange }: Props) {
  const sorted = [...subformFields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const addRow = () => {
    const newRow = getEmptyRow(sorted);
    onChange([...value, newRow]);
    setEditingIndex(value.length);
  };

  const updateRow = (index: number, field: string, newValue: any) => {
    const updated = [...value];
    updated[index] = { ...updated[index], [field]: newValue };
    onChange(updated);
  };

  const deleteRow = (index: number) => {
    const updated = value.filter((_, i) => i !== index);
    onChange(updated);
    setEditingIndex(null);
  };

  const moveRowUp = (index: number) => {
    if (index === 0) return;
    const updated = [...value];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    onChange(updated);
    setEditingIndex(index - 1);
  };

  const moveRowDown = (index: number) => {
    if (index === value.length - 1) return;
    const updated = [...value];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    onChange(updated);
    setEditingIndex(index + 1);
  };

  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-gray-900">{label}</h3>
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1 rounded-md bg-blue-600 text-white px-3 py-1 text-sm hover:bg-blue-700 transition-colors"
        >
          <span>+</span>
          <span>افزودن ردیف</span>
        </button>
      </div>

      {value.length === 0 ? (
        <div className="py-8 text-center text-gray-500">
          هنوز ردیفی اضافه نشده است
        </div>
      ) : (
        <div className="space-y-3">
          {value.map((row, idx) => (
            <div
              key={idx}
              className="border rounded-lg bg-white p-4 shadow-sm"
            >
              {/* Row header with index and controls */}
              <div className="flex justify-between items-center mb-3 pb-3 border-b">
                <span className="text-sm font-medium text-gray-600">ردیف {idx + 1}</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => moveRowUp(idx)}
                    disabled={idx === 0}
                    className="px-2 py-1 text-xs rounded border hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="حرکت به بالا"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveRowDown(idx)}
                    disabled={idx === value.length - 1}
                    className="px-2 py-1 text-xs rounded border hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="حرکت به پایین"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingIndex(editingIndex === idx ? null : idx)}
                    className="px-2 py-1 text-xs rounded border bg-gray-100 hover:bg-gray-200"
                    title={editingIndex === idx ? 'جمع کردن' : 'ویرایش'}
                  >
                    {editingIndex === idx ? '−' : '+'}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteRow(idx)}
                    className="px-2 py-1 text-xs rounded border text-red-600 hover:bg-red-50"
                    title="حذف"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Fields (show all if editing, summary if not) */}
              {editingIndex === idx ? (
                <div className="space-y-3">
                  {sorted.map((f) => (
                    <SubformField
                      key={f.key}
                      field={f}
                      value={row[f.key]}
                      onChange={(newVal) => updateRow(idx, f.key, newVal)}
                    />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {sorted.slice(0, 2).map((f) => (
                    <div key={f.key} className="text-gray-600">
                      <span className="font-medium">{f.labelFa}:</span>
                      {' '}
                      <span className="text-gray-700">
                        {formatCellValue(row[f.key], f.type)}
                      </span>
                    </div>
                  ))}
                  {sorted.length > 2 && (
                    <div className="text-gray-500 text-xs col-span-2 pt-1">
                      و {sorted.length - 2} فیلد دیگر
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** SubformField component for individual field rendering */
function SubformField({
  field,
  value,
  onChange,
}: {
  field: Pick<FormField, 'key'|'labelFa'|'type'|'required'|'config'>;
  value: any;
  onChange: (v: any) => void;
}) {
  const cfg = (field.config ?? {}) as any;
  const common = "w-full rounded-md border px-3 py-2 text-sm";
  const ltr = isLtrField(field.type as FieldType, field.key) ? 'ltr' : 'rtl';

  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">
        {field.labelFa}{field.required ? ' *' : ''}
      </label>

      {field.type === 'text' && (
        <input
          className={common}
          dir={ltr}
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
        />
      )}

      {field.type === 'textarea' && (
        <textarea
          className={common}
          dir="rtl"
          rows={3}
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
        />
      )}

      {field.type === 'number' && (
        <input
          type="text"
          inputMode="decimal"
          className={common}
          dir="ltr"
          value={value ?? ''}
          onChange={(e) => {
            const raw = e.target.value;
            const cleaned = raw.replace(/[^\d۰-۹٠-٩\.\u066B\u060C\u066C-]/g, '');
            onChange(cleaned);
          }}
          placeholder={cfg.placeholder ?? ''}
        />
      )}

      {field.type === 'date' && (
        <JDatePicker
          value={(value as string | undefined) ?? null}
          onChange={(iso) => onChange(iso)}
        />
      )}

      {field.type === 'datetime' && (
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <JDateTimePicker
              value={(value as string | undefined) ?? null}
              onChange={(iso) => onChange(iso)}
            />
          </div>
          <div className="text-sm font-semibold text-gray-700 shrink-0">
            <span>{fmtFaTime(value as string | undefined)}</span>
          </div>
        </div>
      )}

      {field.type === 'checkbox' && (
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!value}
            onChange={e => onChange(e.target.checked)}
          />
          <span className="text-sm">بله</span>
        </label>
      )}

      {field.type === 'select' && (
        <select
          className={common}
          dir="rtl"
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
        >
          <option value="">انتخاب کنید…</option>
          {(cfg?.options ?? []).map((opt: any) => (
            <option key={String(opt.value)} value={String(opt.value)}>
              {optionLabel(opt)}
            </option>
          ))}
        </select>
      )}

      {field.type === 'multiselect' && (
        <select
          multiple
          className={common}
          dir="rtl"
          value={(value ?? []) as string[]}
          onChange={e => {
            const arr = Array.from(e.target.selectedOptions).map(o => o.value);
            onChange(arr);
          }}
        >
          {(cfg?.options ?? []).map((opt: any) => (
            <option key={String(opt.value)} value={String(opt.value)}>
              {optionLabel(opt)}
            </option>
          ))}
        </select>
      )}

      {field.type === 'file' && (
        <input
          type="file"
          className={common}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              const fd = new FormData();
              fd.append('file', file);
              const res = await fetch('/api/uploads', { method: 'POST', body: fd });
              if (!res.ok) throw new Error('خطا در بارگذاری');
              const json = await res.json();
              onChange(json.storageKey as string);
            } catch (ex: any) {
              console.error('File upload error:', ex);
            }
          }}
        />
      )}

      {field.type === 'kardexItem' && (
        <KardexPicker
          label=""
          value={value || ''}
          onSelect={(it) => {
            onChange(it.code);
            if (cfg?.nameKey) {
              // Note: This would require parent to handle nameKey sync
              // For now, just update the main field
            }
          }}
        />
      )}

      {field.type === 'tableSelect' && (
        <TableSelectInput
          label=""
          value={(value as string) ?? ''}
          onChange={(val: string) => onChange(val)}
          config={(cfg?.tableSelect ?? cfg ?? {}) as { table?: string; type?: string }}
        />
      )}
    </div>
  );
}

/** Helper to format cell values for summary display */
function formatCellValue(value: any, type: string): string {
  if (value == null) return '—';
  
  switch (type) {
    case 'checkbox':
      return value ? 'بله' : 'خیر';
    case 'multiselect':
    case 'entryRefMulti':
      return Array.isArray(value) ? `${value.length} مورد` : '—';
    case 'date':
      if (typeof value === 'string') {
        return new Date(value).toLocaleDateString('fa-IR');
      }
      return String(value);
    case 'datetime':
      if (typeof value === 'string') {
        return new Date(value).toLocaleString('fa-IR');
      }
      return String(value);
    case 'number':
      return String(value).padStart(1, '').slice(0, 10);
    default:
      return String(value).slice(0, 20) + (String(value).length > 20 ? '...' : '');
  }
}
