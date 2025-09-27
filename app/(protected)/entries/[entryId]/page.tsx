import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import ConfirmAction from '@/components/ConfirmAction'; // ⬅️ add this

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
            select: { key: true, labelFa: true, type: true, config: true, order: true },
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

  const kardexCodes = fields
    .filter((f) => f.type === 'kardexItem')
    .map((f) => String(payload[f.key] ?? ''))
    .filter(Boolean);

  const tableselectCodes = fields
    .filter((f) => f.type === 'tableSelect') // ⚠️ keep exact casing
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

  const tableselectMap: Record<string, { code: string; title: string }> = {};
  if (tableselectCodes.length) {
    const items = await prisma.fixedInformation.findMany({
      where: { code: { in: tableselectCodes } },
      select: { code: true, title: true },
    });
    for (const it of items) tableselectMap[it.code] = { code: it.code, title: it.title };
  }

  function renderValue(f: typeof fields[number]) {
    const v = payload[f.key];
    if (v == null || v === '') return <span className="text-gray-400">—</span>;

    if (f.type === 'select') {
      const cfg = (f.config as any) ?? {};
      const opts: Array<{ value: string; label: string }> = Array.isArray(cfg.options) ? cfg.options : [];
      const found = opts.find(o => String(o.value) === String(v));
      return <span>{found?.label ?? String(v)}</span>;
    }
    if (f.type === 'multiselect' && Array.isArray(v)) {
      const cfg = (f.config as any) ?? {};
      const opts: Array<{ value: string; label: string }> = Array.isArray(cfg.options) ? cfg.options : [];
      const values: string[] = Array.isArray(v) ? v.map(String) : [];
      const labels = values.map(val => opts.find(o => String(o.value) === val)?.label ?? val);
      return <span>{labels.join('، ')}</span>;
    }

    if (f.type === 'kardexItem') {
      const code = String(v);
      const it = kardexMap[code];
      return <span>{it ? `${it.nameFa} — ${it.code}` : code}</span>;
    }

    if (f.type === 'date' || f.type === 'datetime') {
      return <span dir="ltr" className="font-mono">{fmtDate(v)}</span>;
    }

    if (f.type === 'number') {
      return <span dir="ltr" className="font-mono">{String(v)}</span>;
    }

    if (f.type === 'file') {
      const href = String(v);
      return (
        <a className="text-blue-600 hover:underline" href={href} target="_blank">
          مشاهده فایل
        </a>
      );
    }

    if (f.type === 'entryRef') {
      return <span dir="ltr" className="font-mono">{String(v)}</span>;
    }
    if (f.type === 'entryRefMulti' && Array.isArray(v)) {
      return <span className="font-mono" dir="ltr">{v.join(', ')}</span>;
    }

    if (f.type === 'checkbox') {
      return <span>{v ? 'بله' : 'خیر'}</span>;
    }

    if (f.type === 'tableSelect') {
      const code = String(v);
      const it = tableselectMap[code];
      return <span>{it ? `${it.title} — ${it.code}` : code}</span>;
    }

    return <span>{String(v)}</span>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold">جزئیات فرم</h1>
        <Link href="/confirmations" className="rounded-md border px-4 py-2 hover:bg-gray-50">
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

      {/* Sticky confirm action after reviewing the form */}
      <div className="sticky bottom-0 bg-white/80 backdrop-blur border-t p-4 flex items-center justify-between">
        <span className="text-sm text-gray-600">پس از بررسی اطلاعات، تایید کنید.</span>
        <ConfirmAction entryId={id} />
      </div>
    </div>
  );
}
