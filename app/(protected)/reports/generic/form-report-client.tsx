// app/(protected)/reports/generic/form-report-client.tsx

'use client';

import { useEffect, useMemo, useRef, useState} from 'react'
import { useRouter } from 'next/navigation';
import JDateRangeFilter from '@/components/ui/JDateRangeFilter';
import JDateTimeRangeFilter from '@/components/ui/JDateTimeRangeFilter';
import EditEntryModal from '@/components/forms/EditEntryModal';
import PrintEntry from './components/PrintEntry';
import { useSearchParams } from 'next/navigation';
import type { FieldType } from '@prisma/client';
import { FieldType as FieldTypeEnum } from '@prisma/client';

// ---- Helper functions that don't depend on component state ----

// normalize string → Prisma FieldType (fallback: 'text')
const toFieldType = (v: unknown): FieldType => {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  const allowed = new Set(Object.values(FieldTypeEnum) as string[]);
  return allowed.has(s) ? (s as FieldType) : FieldTypeEnum.text;
};

// robust getters so TS doesn't complain about missing props
const getRequired = (f: any): boolean =>
  typeof f?.required === 'boolean'
    ? f.required
    : typeof f?.isRequired === 'boolean'
    ? f.isRequired
    : typeof f?.config?.required === 'boolean'
    ? f.config.required
    : typeof f?.rules?.required === 'boolean'
    ? f.rules.required
    : false;

const getOrder = (f: any, i: number): number => {
  const o = f?.order ?? f?.sortOrder;
  return Number.isFinite(o) ? Number(o) : i;
};

// ---- Types ----
type Meta = {
  formCode: string;
  titleFa: string;
  page: number;
  pageSize: number;
  total: number;
  visibleColumns?: string[];
  filterableKeys?: string[];
  orderableKeys?: string[];
  defaultOrder?: { key?: string; dir?: 'asc' | 'desc' } | null;
  canSubmit?: boolean;
};
type EntryStatus = 'draft' | 'submitted' | 'confirmed' | 'finalConfirmed';
type Row = { id: string; createdAt: string; status: EntryStatus; payload: Record<string, any> };
type SchemaField = { key: string; type: string; labelFa?: string; config?: any };

// ---- Status helpers (shared by UI) ----
const LOCKED_STATUSES: EntryStatus[] = ['confirmed', 'finalConfirmed'];
function isLockedStatus(s: EntryStatus) {
  return LOCKED_STATUSES.includes(s);
}
function canMutateRow(row: { status: EntryStatus }, canSend: boolean) {
  return !!canSend && !isLockedStatus(row.status); // only 'draft' or 'submitted'
}
function statusFa(s: EntryStatus) {
  switch (s) {
    case 'draft':
      return 'پیش‌نویس';
    case 'submitted':
      return 'ارسال شده';
    case 'confirmed':
      return 'تأیید شده';
    case 'finalConfirmed':
      return 'تأیید نهایی';
  }
}
// Persian labels for booleans (accepts true/false, "true"/"false", 1/0)
function boolFa(v: any) {
  const t = typeof v;
  if (v == null) return '';                 // keep empty for null/undefined
  if (t === 'boolean') return v ? 'بله' : 'خیر';
  if (t === 'number')  return v === 1 ? 'بله' : v === 0 ? 'خیر' : String(v);
  if (t === 'string')  return v.toLowerCase() === 'true' || v === '1' ? 'بله' :
                               v.toLowerCase() === 'false' || v === '0' ? 'خیر' : v;
  return String(v);
}

// Add toEnglishDigits function if not already present
function toEnglishDigits(s: string): string {
  if (!s) return s;
  const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  let result = s;
  
  // Replace Persian digits
  for (let i = 0; i < 10; i++) {
    result = result.replace(new RegExp(persianDigits[i], 'g'), i.toString());
  }
  
  // Replace Arabic digits
  for (let i = 0; i < 10; i++) {
    result = result.replace(new RegExp(arabicDigits[i], 'g'), i.toString());
  }
  
  return result;
}
// ---- Main Component ----
export default function FormReportClient({
  code,
  canSend = false, 
}: {
  code: string;
  canSend?: boolean;
}) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [displayMaps, setDisplayMaps] = useState<Record<string, Record<string, string>>>({});
  const [schema, setSchema] = useState<SchemaField[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  // Edit modal state - REPLACE the old editModal state
  const [editModal, setEditModal] = useState<{
    open: boolean;
    entry?: any;
  }>({ open: false });

  // Update the subform modal state type
  const [subformModal, setSubformModal] = useState<{
    open: boolean;
    fieldKey?: string;
    fieldLabel?: string;
    data?: any[];
    schema?: SchemaField[];
    displayMaps?: Record<string, Record<string, string>>; // Add this
  }>({ open: false });

  // Add this near your other state declarations
  const [printModal, setPrintModal] = useState<{
    open: boolean;
    entry?: any;
  }>({ open: false });

  const ensureEntryLabel = async (id: string) => {
    if (entryLabelCache[id]) return entryLabelCache[id];
    try {
      const r = await fetch(`/api/entries/${id}/summary`, { cache: 'no-store', credentials: 'include', });
      const j = await r.json();
      const label = j?.formTitle || 'مشاهده';
      setEntryLabelCache((prev) => ({ ...prev, [id]: label }));
      return label;
    } catch {
      return 'مشاهده';
    }
  };

  // Define openEntryModal INSIDE the component
  const openEntryModal = async (id: string) => {
    setEntryModal({ open: true, id, loading: true, error: null });
    try {
      const r = await fetch(`/api/entries/${id}/summary`, { cache: 'no-store', credentials: 'include', });
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.message || 'خطا');
      setEntryModal({ open: true, id, loading: false, data: j, error: null });
      // also cache label if not yet cached
      if (j?.formTitle) {
        setEntryLabelCache((prev) => (prev[id] ? prev : { ...prev, [id]: j.formTitle }));
      }
    } catch (e: any) {
      setEntryModal({ open: true, id, loading: false, error: e?.message || 'خطا' });
    }
  };

// Add this useEffect to trigger label fetching
useEffect(() => {
  if (subformModal.open && subformModal.data && subformModal.schema) {
    // Check if we have fields that need labels
    const needsLabels = subformModal.schema.some(f => 
      ['tableSelect', 'kardexItem', 'select', 'multiselect'].includes(f.type)
    );
    
    if (needsLabels) {
      // Check if we already have some labels loaded
      const hasSomeLabels = Object.keys(subformModal.displayMaps || {}).length > 0;
      
      if (!hasSomeLabels) {
        console.log('Fetching labels for subform fields...');
        fetchLabelsForSubform(subformModal.schema, subformModal.data);
      }
    }
  }
}, [subformModal.open, subformModal.data, subformModal.schema]);

  // Replace the openSubformModal function with this version
async function openSubformModal(fieldKey: string, data: any[]) {
  const field = schema.find(s => s.key === fieldKey);
  const fieldLabel = labels[fieldKey] || fieldKey;
  
  // Get subform code from field config
  const subformCode = field?.config?.subformCode;
  let subformSchema: SchemaField[] = [];
  
  if (subformCode) {
    try {
      // Fetch subform fields
      const schemaResponse = await fetch(
        `/api/forms/by-code/${encodeURIComponent(subformCode)}?include=fields`, 
        { cache: 'no-store', credentials: 'include' }
      );
      
      if (schemaResponse.ok) {
        const result = await schemaResponse.json();
        if (result.form?.fields) {
          subformSchema = result.form.fields.map((f: any) => ({
            key: f.key,
            labelFa: f.labelFa,
            type: f.type,
            config: f.config || {}
          }));
        }
      }
    } catch (error) {
      console.error('Failed to load subform schema:', error);
    }
  }
  
  // Fallback: if no schema from API, create schema from data structure
  if (subformSchema.length === 0 && data.length > 0) {
    const firstRow = data[0];
    if (firstRow && typeof firstRow === 'object') {
      subformSchema = Object.keys(firstRow).map(key => ({
        key,
        labelFa: key,
        type: 'text',
        config: {}
      }));
    }
  }
  
  setSubformModal({
    open: true,
    fieldKey,
    fieldLabel,
    data,
    schema: subformSchema,
    displayMaps: {} // Start with empty display maps
  });
  
  // Fetch labels in the background
  fetchLabelsForSubform(subformSchema, data);
}

const fetchLabelsForSubform = async (subformSchema: SchemaField[], data: any[]) => {
  const labelsMap: Record<string, Record<string, string>> = {};
  
  // Process tableSelect fields
  const tableSelectFields = subformSchema.filter(f => f.type === 'tableSelect');
  
  for (const field of tableSelectFields) {
    const table = field.config?.tableSelect?.table;
    const type = field.config?.tableSelect?.type;
    
    if (!table) continue;
    
    // Collect unique values for this field
    const uniqueValues = new Set<string>();
    data.forEach(row => {
      const value = row[field.key];
      if (value && value !== '') {
        uniqueValues.add(String(value));
      }
    });
    
    if (uniqueValues.size === 0) continue;
    
    try {
      // Use the correct API endpoint for table select items
      const url = new URL('/api/table-select/items', window.location.origin);
      url.searchParams.set('table', table);
      if (type) {
        url.searchParams.set('type', type);
      }
      
      const response = await fetch(url.toString(), { 
        cache: 'no-store', 
        credentials: 'include' 
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.ok && Array.isArray(result.items)) {
          // Create a lookup map from the items
          const itemLookup: Record<string, string> = {};
          result.items.forEach((item: any) => {
            if (item.code && item.title) {
              itemLookup[item.code] = item.title;
            }
          });
          
          // Apply labels to our field
          if (!labelsMap[field.key]) {
            labelsMap[field.key] = {};
          }
          
          uniqueValues.forEach(value => {
            labelsMap[field.key][value] = itemLookup[value] || value;
          });
          
          console.log(`Loaded ${Object.keys(itemLookup).length} items for table ${table}`);
        }
      } else {
        console.error(`Failed to fetch items for table ${table}:`, response.status);
      }
    } catch (error) {
      console.error(`Error fetching items for table ${table}:`, error);
    }
  }
  
  // Process kardexItem fields
  const kardexFields = subformSchema.filter(f => f.type === 'kardexItem');
  
  for (const field of kardexFields) {
    // Collect unique values for this field
    const uniqueValues = new Set<string>();
    data.forEach(row => {
      const value = row[field.key];
      if (value && value !== '') {
        uniqueValues.add(String(value));
      }
    });
    
    if (uniqueValues.size === 0) continue;
    
    try {
      // Use the correct API endpoint for kardex items
      const codes = Array.from(uniqueValues).join(',');
      const response = await fetch(`/api/kardex/items?codes=${encodeURIComponent(codes)}`, { 
        cache: 'no-store', 
        credentials: 'include' 
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.ok && Array.isArray(result.items)) {
          // Create a lookup map from the items
          const itemLookup: Record<string, string> = {};
          result.items.forEach((item: any) => {
            if (item.code && item.nameFa) {
              itemLookup[item.code] = item.nameFa;
            }
          });
          
          // Apply labels to our field
          if (!labelsMap[field.key]) {
            labelsMap[field.key] = {};
          }
          
          uniqueValues.forEach(value => {
            labelsMap[field.key][value] = itemLookup[value] || value;
          });
          
          console.log(`Loaded ${Object.keys(itemLookup).length} kardex items`);
        }
      } else {
        console.error(`Failed to fetch kardex items:`, response.status);
      }
    } catch (error) {
      console.error(`Error fetching kardex items:`, error);
    }
  }
  
  // Process select fields (get labels from config options)
  const selectFields = subformSchema.filter(f => f.type === 'select' || f.type === 'multiselect');
  
  for (const field of selectFields) {
    const options = field.config?.options || [];
    if (options.length > 0) {
      if (!labelsMap[field.key]) {
        labelsMap[field.key] = {};
      }
      
      options.forEach((opt: any) => {
        if (opt.value && opt.label) {
          labelsMap[field.key][String(opt.value)] = opt.label;
        }
      });
    }
  }
  
  // Update the modal with fetched labels
  if (Object.keys(labelsMap).length > 0) {
    console.log('Fetched labels:', labelsMap);
    setSubformModal(prev => ({
      ...prev,
      displayMaps: { ...prev.displayMaps, ...labelsMap }
    }));
  }
};

  // Derive from server meta (no extra state → no flicker/race)
  const canSendClient = useMemo(
    () => Boolean(canSend || meta?.canSubmit),
    [canSend, meta?.canSubmit]
  );
  // order state (initialize with sensible defaults; update from meta when it arrives)
  const [orderKey, setOrderKey] = useState<string>('createdAt');
  const [orderDir, setOrderDir] = useState<'asc' | 'desc'>('desc');

  // inside FormReportClient component, near other hooks:
  const searchParams = useSearchParams();
  const DEBUG = searchParams.get('debug') === '1';
  const FORCE = searchParams.get('force') === '1';

  // filters: key -> string | {from?: string; to?: string}
  type Filters = Record<string, any>;
  const [filters, setFilters] = useState<Filters>({});

  // guard so we only initialize order once from server meta
  const didInitOrder = useRef(false);

  // row actions: modal for entry details
  const [entryModal, setEntryModal] = useState<{
    open: boolean;
    id?: string;
    loading?: boolean;
    data?: any;
    error?: string | null;
  }>({ open: false, loading: false, error: null });

  // cache for link labels to avoid refetch each render
  const [entryLabelCache, setEntryLabelCache] = useState<Record<string, string>>({});
  // trigger refetch after mutations
  const [reloadTick, setReloadTick] = useState(0);
  const refresh = () => setReloadTick((t) => t + 1);

  // Build querystring: depends on orderKey/orderDir/filters/schema/filterableKeys
  const qs = useMemo(() => {
    const p = new URLSearchParams();

    // order & paging
    p.set('order', orderKey || 'createdAt');
    p.set('dir', orderDir || 'desc');
    p.set('page', '1');
    p.set('pageSize', '20');
    // forward client ?debug=1 to the API (so API returns _debug)
    if (DEBUG) p.set('debug', '1');
    // determine which keys to serialize:
    // prefer filterableKeys from server; fallback to whatever user edited (filters keys)
    const allowed = new Set([...(meta?.filterableKeys ?? []), ...Object.keys(filters ?? {})]);

    for (const k of allowed) {
      const t = schema.find((s) => s.key === k)?.type || 'text';
      const v = (filters as any)?.[k];

      if (t === 'date' || t === 'datetime') {
        if (v?.from) p.set(`filter_${k}_from`, v.from);
        if (v?.to) p.set(`filter_${k}_to`, v.to);
      } else {
        if (v != null && v !== '') p.set(`filter_${k}`, String(v));
      }
    }

    return `?${p.toString()}`;
  }, [orderKey, orderDir, filters, meta?.filterableKeys, schema]);

  // Fetch data (refires on reloadTick)
  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(
          `/api/reports/${encodeURIComponent(code)}/entries${qs}`,
          { cache: 'no-store', credentials: 'include', }
        );
        const j = await res.json();

        if (!cancel) {
          setMeta(j.meta);
          setLabels(j.labels || {});
          setRows(Array.isArray(j.rows) ? j.rows : []);
          setDisplayMaps(
            j.displayMaps && typeof j.displayMaps === 'object' ? j.displayMaps : {}
          );
          setSchema(Array.isArray(j.schema) ? j.schema : []); // 👈 important

          // Initialize order ONLY ONCE from server-provided defaults
          if (!didInitOrder.current) {
            const initialKey =
              j.meta?.orderApplied || j.meta?.defaultOrder?.key || 'createdAt';
            const initialDir = j.meta?.defaultOrder?.dir || 'desc';
            setOrderKey(initialKey);
            setOrderDir(initialDir);
            didInitOrder.current = true;
          }
        }
      } catch (e: any) {
        if (!cancel) setErr(e?.message || 'خطا');
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [code, qs, reloadTick]);
  
  const schemaArr = Array.isArray(schema) ? schema : []; // 👈 normalize once

  // Build map key->type
  const typeByKey = useMemo(() => {
    const m: Record<string, string> = {};
    schemaArr.forEach((f) => {
      m[f.key] = f.type;
    });
    return m;
  }, [schemaArr]);

  const visible = useMemo(() => {
    if (meta?.visibleColumns?.length) return meta.visibleColumns;
    if (schemaArr.length) return schemaArr.map((f) => f.key);
    if (rows[0]?.payload) return Object.keys(rows[0].payload);
    return [];
  }, [meta, schemaArr, rows]);

  // Format persian date
  function formatJalali(dateLike: string | number | Date, withTime = false) {
    try {
      const d = new Date(dateLike);
      const opts: Intl.DateTimeFormatOptions = withTime
        ? {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          }
        : { year: 'numeric', month: '2-digit', day: '2-digit' };
      return new Intl.DateTimeFormat('fa-IR-u-ca-persian', opts).format(d);
    } catch {
      return String(dateLike ?? '');
    }
  }

  const renderSubformCell = (
  field: SchemaField, 
  value: any, 
  displayMaps?: Record<string, Record<string, string>>
): React.ReactNode => {
  if (value == null || value === '') return '-';
  
  const t = field.type;
  const valueStr = String(value);
  
  // checkbox/boolean
  if (t === 'checkbox') {
    return boolFa(value);
  }
  
  // date/datetime
  if (t === 'date' && value) return formatJalali(value, false);
  if (t === 'datetime' && value) return formatJalali(value, true);
  
  // number - convert Persian/Arabic digits to English
  if (t === 'number') {
    return toEnglishDigits(valueStr);
  }
  
  // select - get label from options
  if (t === 'select') {
    const options = field.config?.options || [];
    const option = options.find((opt: any) => String(opt.value) === valueStr);
    return option?.label || valueStr;
  }
  
  // multiselect
  if (t === 'multiselect' && Array.isArray(value)) {
    const options = field.config?.options || [];
    return value.map(v => {
      const option = options.find((opt: any) => String(opt.value) === String(v));
      return option?.label || String(v);
    }).join('، ');
  }
  
  // tableSelect, kardexItem - use display maps
  if (t === 'tableSelect' || t === 'kardexItem') {
    // Try to find the label in display maps
    const label = displayMaps?.[field.key]?.[valueStr];
    
    // Return the label if found and different from value
    if (label && label !== valueStr) {
      return label;
    }
    
    // If no label found, show the code (without extra styling)
    return valueStr;
  }
  
  // For all other types, return string value
  return valueStr;
};

  // Generic value renderer for modal/export (maps + date formats)
  function renderValueGeneric(
    key: string,
    value: any,
    schemaArr: { key: string; type: string; config?: any }[] | undefined,
    maps: Record<string, Record<string, string>> | undefined
  ) {
    const t = schemaArr?.find((s) => s.key === key)?.type;

    // entryRef / entryRefMulti handled elsewhere (we show raw ids here)
    if (t === 'entryRef' || t === 'entryRefMulti') {
      if (Array.isArray(value)) return value.join('، ');
      return value ?? '';
    }

    // date / datetime
    if (t === 'date' && value) return formatJalali(value, false);
    if (t === 'datetime' && value) return formatJalali(value, true);

    // select-like (includes tableSelect & kardexItem because we pass maps)
    const map = maps?.[key];
    if (Array.isArray(value)) return value.map((v) => map?.[String(v)] ?? String(v)).join('، ');
    if (value == null) return '';
    return map?.[String(value)] ?? String(value);
  }

  // Render cell by type + map
  function renderCell(key: string, value: any) {
    const t = typeByKey[key];
    // ✔ boolean/checkbox → بله/خیر
    if (t === 'checkbox' || t === 'boolean') {
      return <span>{boolFa(value)}</span>;
    }
    // entryRef -> clickable link with form title
    if (t === 'entryRef' && typeof value === 'string' && value) {
      const label = entryLabelCache[value];
      if (!label) {
        // lazy load label (non-blocking)
        ensureEntryLabel(value);
      }
      return (
        <button
          type="button"
          className="text-blue-600 hover:underline"
          onClick={() => openEntryModal(value)}
          title="مشاهده جزئیات"
        >
          {label || '...'}
        </button>
      );
    }

    // entryRefMulti -> chips of links
    if (t === 'entryRefMulti' && Array.isArray(value)) {
      return (
        <div className="flex flex-wrap gap-1">
          {value.map((id: any, i: number) => {
            if (typeof id !== 'string' || !id) return null;
            const lbl = entryLabelCache[id];
            if (!lbl) ensureEntryLabel(id);
            return (
              <button
                key={`${id}-${i}`}
                type="button"
                className="rounded-full border px-2 py-0.5 text-xs hover:bg-gray-50 text-blue-700 border-blue-200"
                onClick={() => openEntryModal(id)}
                title="مشاهده جزئیات"
              >
                {lbl || '...'}
              </button>
            );
          })}
        </div>
      );
    }

    // date/datetime
    if (t === 'date' && value) return formatJalali(value, false);
    if (t === 'datetime' && value) return formatJalali(value, true);

    // subform -> clickable link that shows content in modal
    if (t === 'subform' && Array.isArray(value)) {
      const count = value.length;
      return (
        <button
          type="button"
          className="text-blue-600 hover:underline"
          onClick={() => openSubformModal(key, value)}
          title="مشاهده محتوای فرم تکراری"
        >
          {count} مورد
        </button>
      );
    }

    // select/multiselect/kardexItem label maps
    const map = displayMaps?.[key];
    if (Array.isArray(value)) {
      return value.map((v, i) => (
        <span key={i} className="inline-block mx-0.5">
          {map?.[String(v)] ?? String(v)}
        </span>
      ));
    }
    if (value == null) return '';
    return map?.[String(value)] ?? String(value);
  }

  // --- Excel export state
  const [exporting, setExporting] = useState(false);

  // Normalize ESM/CJS import of xlsx
  function getXLSX(mod: any) {
    return mod?.default ?? mod;
  }

  // Preload labels for entryRef / entryRefMulti values found in current rows
  async function preloadEntryLabelsForRows(rws: Row[]) {
    const need = new Set<string>();
    for (const r of rws) {
      for (const k of visible) {
        const t = typeByKey[k];
        const v = r.payload?.[k];
        if (t === 'entryRef' && typeof v === 'string' && v) need.add(v);
        if (t === 'entryRefMulti' && Array.isArray(v)) {
          v.forEach((id: any) => typeof id === 'string' && id && need.add(id));
        }
      }
    }
    await Promise.all(Array.from(need).map((id) => ensureEntryLabel(id)));
  }

  // Turn a cell value into exportable text
  function valueForExport(key: string, raw: any): string {
    const t = typeByKey[key];

    // entryRef / entryRefMulti -> use cached labels (fallback to raw ids)
    if (t === 'entryRef') {
      const id = typeof raw === 'string' ? raw : '';
      const lbl = entryLabelCache[id];
      return lbl ? `${lbl} (${id})` : id || '';
    }
    if (t === 'entryRefMulti') {
      const ids = Array.isArray(raw) ? raw : [];
      const texts = ids.map((id) =>
        entryLabelCache[id] ? `${entryLabelCache[id]} (${id})` : String(id)
      );
      return texts.join('، ');
    }
    // subform -> show count in export
    if (t === 'subform') {
      const count = Array.isArray(raw) ? raw.length : 0;
      return `${count} ردیف`;
    }
    // dates / selects / tableSelect / kardexItem handled via generic renderer
    const rendered = renderValueGeneric(key, raw, schemaArr, displayMaps);
    return String(rendered ?? '');
  }

  // Auto size columns by content length
  function autosizeCols(rowsAoA: any[][]) {
    const colCount = Math.max(...rowsAoA.map((r) => r.length));
    const widths = Array.from({ length: colCount }, (_, c) => {
      let max = 8;
      for (const row of rowsAoA) {
        const cell = row[c] == null ? '' : String(row[c]);
        max = Math.max(max, cell.length);
      }
      // Excel width in "characters" — cap to something reasonable
      return { wch: Math.min(max + 2, 40) };
    });
    return widths;
  }

  async function exportCurrentPageToExcel() {
    if (!rows?.length) {
      alert('چیزی برای خروجی وجود ندارد');
      return;
    }

    setExporting(true);
    try {
      // Make sure labels for refs exist so we export readable text
      await preloadEntryLabelsForRows(rows);

      const mod = await import('xlsx');
      const XLSX = getXLSX(mod);

      // Header row (same order as table)
      const header = ['#', 'تاریخ ایجاد', ...visible.map((k) => labels[k] || k), 'وضعیت'];

      // Data rows
      const body = rows.map((r, i) => {
        const rowIdx = (meta!.page - 1) * meta!.pageSize + i + 1;
        const created = formatJalali(r.createdAt, true);
        const payloadCells = visible.map((k) => valueForExport(k, r.payload?.[k]));
        const status = statusFa(r.status);
        return [rowIdx, created, ...payloadCells, status];
      });

      const aoa = [header, ...body];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = autosizeCols(aoa);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Report');

      const fname = `${
        meta?.titleFa || meta?.formCode || code
      }-گزارش-${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fname);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ? `خطا در ساخت فایل اکسل: ${e.message}` : 'خطا در ساخت فایل اکسل');
    } finally {
      setExporting(false);
    }
  }

  // open editor only if eligible - UPDATED to use EditEntryModal
  function openEdit(row: Row) {
    //console.log('openEdit', { row, canSendClient });
    if (!canSendClient) return;
    if (row.status !== 'submitted' && row.status !== 'draft') return;
    
    // Prepare entry data for EditEntryModal
    const entryData = {
      id: row.id,
      createdAt: row.createdAt,
      status: row.status,
      payload: { ...(row.payload ?? {}) },
      form: {
        code: meta?.formCode || code,
        titleFa: meta?.titleFa || 'فرم'
      }
    };
    setEditModal({
      open: true,
      entry: entryData
    });
  }

  // Handle save from EditEntryModal - NEW FUNCTION
  async function handleSave(updatedData: Record<string, any>) {
    if (!editModal.entry?.id) return;
    
    try {
      const r = await fetch(`/api/entries/${editModal.entry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: updatedData }),
        credentials: 'include',
      });
      
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.message || 'خطا در ذخیره تغییرات');
      }
      
      setEditModal({ open: false });
      refresh(); // reload table
    } catch (e: any) {
      throw new Error(e?.message || 'خطا در ذخیره تغییرات');
    }
  }

  async function handleDelete(id: string) {
    if (!canSendClient) return;
    const ok = confirm('آیا از حذف این آیتم مطمئن هستید؟ این عمل غیرقابل بازگشت است.');
    if (!ok) return;
    try {
      const r = await fetch(`/api/entries/${id}`, { method: 'DELETE', credentials: 'include', });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.message || 'خطا در حذف');
      refresh();
    } catch (e: any) {
      alert(e?.message || 'خطا در حذف');
    }
  }

  return (
    <div className="space-y-4">
      {DEBUG && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs ltr">
          <div>meta.canSubmit: {String(meta?.canSubmit)}</div>
          <div>canSendClient (derived): {String(canSendClient)}</div>          
          <div>formCode(meta): {String(meta?.formCode)}</div>
          <div>rows: {rows.length}</div>
          <div>statuses: {[...new Set(rows.map(r => r.status))].join(', ') || '(none)'}</div>
        </div>
      )}

      {err && <div className="text-red-600 text-sm">{err}</div>}

      {/* Controls */}
      <div className="rounded-xl border bg-white p-3 space-y-3">
        {/* Filters */}
        {meta?.filterableKeys?.length ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3" dir="rtl">
            {meta.filterableKeys.map((k) => {
              const label = labels[k] || k;
              const field = schema.find((s) => s.key === k);
              const t = field?.type || 'text';
              const cfg = (field?.config ?? {}) as any;
              const v = filters[k];

              // tableSelect: select populated by configured table/type
              if (
                t === 'tableSelect' &&
                field?.config?.tableSelect?.type &&
                field?.config?.tableSelect
              ) {
                const ts = field.config.tableSelect;
                return (
                  <TableSelectFilter
                    key={k}
                    label={label}
                    table={ts.table ?? 'fixedInformation'}
                    type={ts.type}
                    value={typeof v === 'string' ? v : ''}
                    onChange={(code) =>
                      setFilters((prev) => ({ ...prev, [k]: code }))
                    }
                  />
                );
              }

              if (t === 'date') {
                return (
                  <div key={k} className="space-y-1 overflow-visible">
                    <JDateRangeFilter
                      label={label}
                      value={v || {}}
                      onChange={(nv) =>
                        setFilters((prev) => ({ ...prev, [k]: nv }))
                      }
                    />
                  </div>
                );
              }

              if (t === 'datetime') {
                return (
                  <div key={k} className="space-y-1 overflow-visible">
                    <JDateTimeRangeFilter
                      label={label}
                      value={v || {}}
                      onChange={(nv) =>
                        setFilters((prev) => ({ ...prev, [k]: nv }))
                      }
                    />
                  </div>
                );
              }

              if (t === 'select' || t === 'multiselect') {
                const opts: Array<{ value: string; label: string }> = Array.isArray(
                  cfg.options
                )
                  ? cfg.options
                  : [];
                return (
                  <div key={k} className="space-y-1">
                    <label className="text-xs text-gray-600 block">{label}</label>
                    {/* single-select filter; feel free to switch to multiple */}
                    <select
                      className="w-full border rounded-md px-2 py-1"
                      dir="rtl"
                      value={v ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFilters((prev) => {
                          const next = { ...prev };
                          if (!val) delete next[k];
                          else next[k] = val;
                          return next;
                        });
                      }}
                    >
                      <option value="">همه</option>
                      {opts.map((o, i) => (
                        <option
                          key={`${k}-${i}-${String(o.value)}`}
                          value={String(o.value)}
                        >
                          {String(o.label ?? o.value)}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              }

              // default text filter
              return (
                <div key={k} className="space-y-1">
                  <label className="text-xs text-gray-600 block">{label}</label>
                  <input
                    className="w-full border rounded-md px-2 py-1"
                    dir="rtl"
                    value={v || ''}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, [k]: e.target.value }))
                    }
                    placeholder={`جستجو در ${label}…`}
                  />
                </div>
              );
            })}
          </div>
        ) : null}

        {/* Ordering */}
        <div className="flex flex-wrap items-center gap-3" dir="rtl">
          <div className="text-xs text-gray-600">مرتب‌سازی:</div>
          <select
            className="border rounded-md px-2 py-1"
            value={orderKey}
            onChange={(e) => setOrderKey(e.target.value)}
          >
            {(meta?.orderableKeys ?? ['createdAt']).map((k) => (
              <option key={k} value={k}>
                {labels[k] || (k === 'createdAt' ? 'تاریخ ایجاد' : k)}
              </option>
            ))}
          </select>
          <select
            className="border rounded-md px-2 py-1"
            value={orderDir}
            onChange={(e) => setOrderDir(e.target.value as 'asc' | 'desc')}
          >
            <option value="asc">صعودی</option>
            <option value="desc">نزولی</option>
          </select>

          <div className="ms-auto flex items-center gap-2">
            <button
              type="button"
              className="rounded-md border px-3 py-1 hover:bg-gray-50"
              onClick={() => setFilters({})}
            >
              حذف فیلترها
            </button>

            <button
              type="button"
              onClick={exportCurrentPageToExcel}
              disabled={exporting || !rows?.length}
              className="rounded-md border px-3 py-1 hover:bg-gray-50 disabled:opacity-50"
              title="خروجی اکسل از سطرهای صفحه فعلی با فیلتر و مرتب‌سازی فعلی"
            >
              {exporting ? 'در حال ساخت اکسل…' : 'خروجی اکسل'}
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-white overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="p-2 text-right whitespace-nowrap">#</th>
              <th className="p-2 text-right whitespace-nowrap">تاریخ ایجاد</th>
              {visible.map((k) => (
                <th key={k} className="p-2 text-right whitespace-nowrap">
                  {labels[k] || k}
                </th>
              ))}
              <th className="p-2 text-right whitespace-nowrap">وضعیت</th>
              {/* actions on the left */}
              <th className="p-2 text-left whitespace-nowrap w-24">اقدامات</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className="border-t">
                <td className="p-2 whitespace-nowrap">
                  {(meta!.page - 1) * meta!.pageSize + i + 1}
                </td>
                <td className="p-2 whitespace-nowrap ltr">
                  {formatJalali(r.createdAt, true)}
                </td>

                {visible.map((k) => (
                  <td key={k} className="px-3 py-2">
                    {renderCell(k, r.payload?.[k])}
                  </td>
                ))}

                <td className="p-2 whitespace-nowrap">{statusFa(r.status)}</td>

                {/* small edit/delete buttons (only for eligible rows) */}
                <td className="p-2 whitespace-nowrap text-left">
                  {canMutateRow(r, canSendClient) ? (
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
                        onClick={() => openEdit(r)}
                        title="ویرایش"
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className="rounded border px-2 py-1 text-xs text-red-600 border-red-300 hover:bg-red-50"
                        onClick={() => handleDelete(r.id)}
                        title="حذف"
                      >
                        🗑
                      </button>
                      <button
                        type="button"
                        className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
                        onClick={() => setPrintModal({ open: true, entry: r })}
                        title="چاپ"
                    >
                      🖨️
                    </button>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
              </tr>
            ))}

            {(!rows || rows.length === 0) && (
              <tr>
                <td
                  className="p-4 text-center text-gray-500"
                  colSpan={(visible?.length ?? 0) + 4}
                >
                  {loading ? 'در حال بارگذاری…' : 'داده‌ای یافت نشد'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Entry details modal */}
      <Modal open={entryModal.open} onClose={() => setEntryModal({ open: false })}>
        {entryModal.loading && (
          <div className="text-sm text-gray-600">در حال بارگذاری…</div>
        )}
        {entryModal.error && (
          <div className="text-sm text-red-600">{entryModal.error}</div>
        )}

        {entryModal.data && (
          <div dir="rtl" className="space-y-3">
            <div className="font-bold text-base">{entryModal.data.formTitle}</div>
            <div className="text-xs text-gray-500 ltr">
              {formatJalali(entryModal.data.createdAt, true)} •{' '}
              {statusFa(entryModal.data.status)}
            </div>

            <div className="divide-y">
              {Object.entries(entryModal.data.payload || {}).map(([k, v]: any) => {
                const lbl = entryModal.data.labels?.[k] || k;
                const rendered = renderValueGeneric(
                  k,
                  v,
                  entryModal.data.schema,
                  entryModal.data.displayMaps
                );
                return (
                  <div key={k} className="py-2 grid grid-cols-3 gap-2">
                    <div className="text-gray-600 text-sm">{lbl}</div>
                    <div className="col-span-2 text-sm break-words">{rendered}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Modal>
    
    {printModal.open && printModal.entry && (
      <PrintEntry
        entry={printModal.entry}
        schema={schemaArr}
        labels={labels}
        displayMaps={displayMaps}
        isOpen={printModal.open}
        onClose={() => setPrintModal({ open: false })}
      />
    )}

    {editModal.open && editModal.entry && (
      <EditEntryModal
        entry={editModal.entry}
        fields={schemaArr.map((field: any, i: number) => ({
          key: String(field.key),
          labelFa: labels[field.key] || String(field.key),
          type: field.type,
          required: getRequired(field),
          config: field?.config ?? null,
          order: getOrder(field, i),
        }))}
        isOpen={true}
        onClose={() => setEditModal({ open: false, entry: null })}
        onSave={async (updatedData) => {
          const id = editModal.entry!.id;
          try {
            // IMPORTANT: your API expects { payload: ... }
            const res = await fetch(`/api/entries/${id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ payload: updatedData }),
            });
            if (!res.ok) {
              const txt = await res.text().catch(() => '');
              throw new Error(txt || 'خطا در ذخیره تغییرات');
            }

            // Optimistic update so the table changes immediately
            setRows(prev =>
              prev.map(r =>
                r.id === id ? { ...r, payload: { ...r.payload, ...updatedData } } : r
              )
            );

            setEditModal({ open: false, entry: null });

            // Trigger the client fetch useEffect (this actually refetches /api/reports/..)
            refresh();

            // (router.refresh() only helps server components; optional to keep)
            // router.refresh();
          } catch (err: any) {
            console.error(err);
            alert(err?.message || 'به‌روزرسانی ناموفق بود.');
          }
        }}
      />
    )}

    {/* Subform details modal */}
    <Modal 
      open={subformModal.open} 
      onClose={() => setSubformModal({ open: false })}
      size="lg"
    >
      {subformModal.data && (
        <div dir="rtl" className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="font-bold text-lg">{subformModal.fieldLabel || 'فرم تکراری'}</div>
            
          </div>
          
          <div className="text-sm text-gray-500">
            تعداد ردیف‌ها: {subformModal.data.length}
          </div>
          
          {subformModal.schema && subformModal.schema.length > 0 ? (
            <>
              {/* Debug info */}
              {DEBUG && (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-xs">
                  <div>Schema fields: {subformModal.schema.map(f => `${f.key}(${f.type})`).join(', ')}</div>
                  <div>Display maps keys: {Object.keys(subformModal.displayMaps || {}).join(', ')}</div>
                </div>
              )}
              
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-2 border text-right">ردیف</th>
                      {subformModal.schema.map((field, idx) => (
                        <th key={field.key || idx} className="p-2 border text-right">
                          {field.labelFa || field.key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {subformModal.data.map((row: any, rowIndex: number) => (
                      <tr key={rowIndex} className="border-t hover:bg-gray-50">
                        <td className="p-2 border text-center">{rowIndex + 1}</td>
                        {subformModal.schema!.map((field, colIndex) => {
                          const value = row[field.key];
                          return (
                            <td key={`${rowIndex}-${colIndex}`} className="p-2 border">
                              {renderSubformCell(field, value, subformModal.displayMaps)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Show note if some fields still show codes */}
              {Object.keys(subformModal.displayMaps || {}).length === 0 && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
                  <p>در حال دریافت اطلاعات کالاها و واحدها... ممکن است کدها به جای نام نمایش داده شوند.</p>
                </div>
              )}
            </>
          ) : (
            // Fallback: show raw data if schema is not available
            <div className="bg-gray-50 p-4 rounded-md">
              <div className="text-sm text-gray-600 mb-2">طرح‌بندی فرم در دسترس نیست. داده‌ها به صورت خام نمایش داده می‌شوند:</div>
              <pre className="text-xs bg-white p-3 rounded border overflow-auto max-h-96">
                {JSON.stringify(subformModal.data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </Modal>
  </div>
  );
}

  // ---- Inline helpers/components ----
  function TableSelectFilter({
    label,
    table,
    type,
    value,
    onChange,
  }: {
    label: string;
    table: string;
    type: string;
    value?: string;
    onChange: (v: string) => void;
  }) {
    const [opts, setOpts] = useState<{ code: string; title: string }[]>([]);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
      let cancel = false;
      (async () => {
        setLoading(true);
        setErr(null);
        try {
          const url = `/api/table-select/data/options?codes=${encodeURIComponent(
            table
          )}&type=${encodeURIComponent(type)}&limit=200`;
          const r = await fetch(url, { cache: 'no-store', credentials: 'include', });
          const j = await r.json();

          // Accept either: { items: [{code,title}] } OR { options: [{value,label}] }
          const raw: any[] = Array.isArray(j?.items)
            ? j.items
            : Array.isArray(j?.options)
            ? j.options
            : [];

          const normalized = raw
            .map((it: any) => ({
              code: it.code ?? it.value ?? '',
              title: it.title ?? it.label ?? '',
            }))
            .filter((x: { code: string; title: string }) => !!x.code && !!x.title);

          if (!cancel) setOpts(normalized);
        } catch (e: any) {
          if (!cancel) setErr(e?.message || 'خطا در بارگذاری گزینه‌ها');
        } finally {
          if (!cancel) setLoading(false);
        }
      })();
      return () => {
        cancel = true;
      };
    }, [table, type]);

    return (
      <div className="space-y-1">
        <label className="text-xs text-gray-600 block">{label}</label>
        <select
          className="w-full border rounded-md px-2 py-1"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{loading ? 'در حال بارگذاری…' : '— انتخاب کنید —'}</option>
          {opts.map((o) => (
            <option key={o.code} value={o.code}>
              {o.title}
            </option>
          ))}
        </select>
        {err && <div className="text-xs text-red-600">{err}</div>}
      </div>
    );
  }

  function Modal({
  open,
  onClose,
  children,
  size = 'md', // Add size prop
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl'; // Add size options
}) {
  if (!open) return null;
  
  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-3xl',
    xl: 'max-w-5xl'
  };
  
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div 
          className={`w-full ${sizeClasses[size]} rounded-xl bg-white shadow-lg border p-4 overflow-auto max-h-[80vh]`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-left">
            <button
            className="text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 px-3 py-1 rounded"
              onClick={onClose}
            >
              بستن
            </button>
          </div>
          <div className="mt-2">{children}</div>
        </div>
      </div>
    </div>
  );
 }
