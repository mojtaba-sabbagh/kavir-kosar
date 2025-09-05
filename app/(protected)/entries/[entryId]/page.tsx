
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import { cloneElement } from 'react';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function fmtDate(v: string | Date | null | undefined) {
  if (!v) return '';
  const d = typeof v === 'string' ? new Date(v) : v;
  if (Number.isNaN(+d)) return String(v);
  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d);
}

export default async function EntryByIdPage(props: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await props.params;
  const id = entryId;
  // Load entry + form fields (with config) to map labels
  const entry = await prisma.formEntry.findUnique({
    where: { id },
    select: {
      id: true,
      createdAt: true,
      status: true,
      payload: true,
      form: {
        select: {
          id: true,
          code: true,
          titleFa: true,
          fields: {
            select: {
              key: true,
              labelFa: true,
              type: true,
              config: true,
              order: true,
            },
          },
        },
      },
    },
  });

  if (!entry || !entry.form) notFound();

  const fields = [...(entry.form.fields ?? [])].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0)
  );

  const payload = (entry.payload ?? {}) as Record<string, any>;

  // Pre-resolve Kardex items for display name (for fields of type kardexItem)
  const kardexCodes = fields
    .filter((f) => f.type === 'kardexItem')
    .map((f) => String(payload[f.key] ?? ''))
    .filter(Boolean);

  const kardexMap: Record<string, { code: string; nameFa: string }> = {};
  if (kardexCodes.length) {
    const items = await prisma.kardexItem.findMany({
      where: { code: { in: kardexCodes } },
      select: { code: true, nameFa: true },
    });
    for (const it of items) kardexMap[it.code] = { code: it.code, nameFa: it.nameFa };
  }

  // Helper to format each field’s value using label + config
  function renderValue(f: typeof fields[number]) {
    const v = payload[f.key];

    if (v == null || v === '') return <span className="text-gray-400">—</span>;

    // select / multiselect → map to option labels
    if (f.type === 'select') {
      const opts = (f.config?.options ?? []) as Array<{ value: string; label: string }>;
      const found = opts.find((o) => String(o.value) === String(v));
      return <span>{found?.label ?? String(v)}</span>;
    }
    if (f.type === 'multiselect' && Array.isArray(v)) {
      const opts = (f.config?.options ?? []) as Array<{ value: string; label: string }>;
      const labels = v
        .map((x: any) => opts.find((o) => String(o.value) === String(x))?.label ?? String(x))
        .join('، ');
      return <span>{labels}</span>;
    }

    // kardexItem → show nameFa — code
    if (f.type === 'kardexItem') {
      const code = String(v);
      const it = kardexMap[code];
      return <span>{it ? `${it.nameFa} — ${it.code}` : code}</span>;
    }

    // date / datetime
    if (f.type === 'date' || f.type === 'datetime') {
      return <span dir="ltr" className="font-mono">{fmtDate(v)}</span>;
    }

    // number → show LTR monospace
    if (f.type === 'number') {
      return <span dir="ltr" className="font-mono">{String(v)}</span>;
    }

    // file → link to stored path
    if (f.type === 'file') {
      const href = String(v);
      return (
        <a className="text-blue-600 hover:underline" href={href} target="_blank">
          مشاهده فایل
        </a>
      );
    }

    // entryRef / entryRefMulti → show ids count (or list)
    if (f.type === 'entryRef') {
      return <span dir="ltr" className="font-mono">{String(v)}</span>;
    }
    if (f.type === 'entryRefMulti' && Array.isArray(v)) {
      return (
        <span className="font-mono" dir="ltr">
          {v.join(', ')}
        </span>
      );
    }

    // default (text/textarea/checkbox)
    if (f.type === 'checkbox') {
      return <span>{v ? 'بله' : 'خیر'}</span>;
    }

    return <span>{String(v)}</span>;
  }

  return (      
    <div className="space-y-6">
    
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold">جزئیات فرم</h1>
        <Link
        href="/confirmations"
        className="rounded-md border px-4 py-2 hover:bg-gray-50"
        >
        بازگشت
        </Link>
      </div>

      <div className="mb-4">
        <h1 className="text-xl font-bold">{entry.form.titleFa}</h1>
        <div className="text-sm text-gray-500 mt-1 flex gap-2">
          <span>کد: {entry.form.code}</span>
          <span>تاریخ: {fmtDate(entry.createdAt)}</span>
          <span>وضعیت: {entry.status}</span>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          {fields.map((f) => (
            <div key={f.key} className="border-b pb-2">
              <dt className="text-xs text-gray-500 mb-1">{f.labelFa ?? f.key}</dt>
              <dd className="text-sm">{renderValue(f)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
