import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// We’ll filter client-side for JSON payload (practical, safe start). Optimize later with $queryRaw if needed.
const Q = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  orderKey: z.string().optional(),
  orderDir: z.enum(['asc','desc']).optional(),
  // filters come as JSON string in ?filters=
  filters: z.string().optional(),
});

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const url = new URL(req.url);
  const q = Q.safeParse({
    page: url.searchParams.get('page') ?? undefined,
    pageSize: url.searchParams.get('pageSize') ?? undefined,
    orderKey: url.searchParams.get('orderKey') ?? undefined,
    orderDir: url.searchParams.get('orderDir') ?? undefined,
    filters: url.searchParams.get('filters') ?? undefined,
  });
  if (!q.success) return NextResponse.json({ message: 'ورودی نامعتبر' }, { status: 422 });
  const params = await ctx.params;
  const form = await prisma.form.findUnique({
    where: { code: params.id },
    include: {
      fields: {
      select: { key: true, type: true, labelFa: true, config: true, order: true },
      orderBy: { order: 'asc' },
      },
    }    
  });
  if (!form) return NextResponse.json({ message: 'فرم یافت نشد' }, { status: 404 });
  
  // 🔹 Get actual report config from the Report table
  const reportCfg = await prisma.report.findUnique({
    where: { formId: form.id },
    select: {
      visibleColumns: true,
      filterableKeys: true,
      orderableKeys: true,
      defaultOrder: true,
    },
  });
  const visibleColumns: string[] = reportCfg?.visibleColumns ?? [];
  const filterableKeys: string[] = reportCfg?.filterableKeys ?? [];
  const orderableKeys: string[] = reportCfg?.orderableKeys ?? [];
  const defaultOrder = (reportCfg?.defaultOrder as any) ?? { key: 'createdAt', dir: 'desc' };

  // Basic server-side page window; filtering on payload is done in app layer
  const skip = (q.data.page - 1) * q.data.pageSize;
  const take = q.data.pageSize;

  const [total, rows] = await Promise.all([
    prisma.formEntry.count({ where: { formId: form.id } }),
    prisma.formEntry.findMany({
      where: { formId: form.id },
      orderBy:
        q.data.orderKey === 'createdAt'
          ? { createdAt: q.data.orderDir ?? 'desc' }
          : { createdAt: 'desc' }, // default fallback
      skip, take,
      select: { id: true, createdAt: true, payload: true },
    }),
  ]);

  // Apply filters in application layer (safe start)
  let items = rows.map(r => ({
    id: r.id,
    createdAt: r.createdAt,
    payload: r.payload as Record<string, any>,
  }));

  const filters = q.data.filters ? safeParseJSON(q.data.filters) : null;
  if (filters && typeof filters === 'object') {
    items = items.filter(it => matchFilters(it.payload, filters, form.fields));
  }

  // 3) Allowed order keys + resolve order
  const allowedOrderKeys = new Set<string>(['createdAt', ...orderableKeys]);

const oKey =
  (q.data.orderKey && allowedOrderKeys.has(q.data.orderKey))
    ? q.data.orderKey
    : (defaultOrder.key ?? 'createdAt');

const oDir = ((q.data.orderDir ?? defaultOrder.dir ?? 'desc') === 'asc' ? 'asc' : 'desc') as 'asc'|'desc';

  if (oKey && oKey !== 'createdAt') {
    const dir = oDir === 'asc' ? 1 : -1;
    items.sort((a, b) => {
      const va = a.payload?.[oKey];
      const vb = b.payload?.[oKey];
      if (va == null && vb == null) return 0;
      if (va == null) return -dir;
      if (vb == null) return dir;
      return String(va).localeCompare(String(vb), 'fa') * dir;
    });
  }

  return NextResponse.json({ total, items });
}

function safeParseJSON(s?: string | null) {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}

// Very small, generic matcher: supports text contains, equals, number range, date range
function matchFilters(payload: Record<string, any>, filters: any, fields: Array<{key:string;type:string;config:any}>): boolean {
  for (const [k, cond] of Object.entries<any>(filters)) {
    const def = fields.find(f => f.key === k);
    const v = payload[k];

    if (cond == null || cond === '') continue;

    if (def?.type === 'number') {
      const num = Number(v);
      if ('min' in cond && cond.min != null && !(num >= Number(cond.min))) return false;
      if ('max' in cond && cond.max != null && !(num <= Number(cond.max))) return false;
      continue;
    }
    if (def?.type === 'date' || def?.type === 'datetime') {
      const ts = v ? new Date(v).getTime() : NaN;
      if ('from' in cond && cond.from && !(ts >= new Date(cond.from).getTime())) return false;
      if ('to'   in cond && cond.to   && !(ts <= new Date(cond.to).getTime())) return false;
      continue;
    }
    if (def?.type === 'select') {
      if (cond !== v) return false;
      continue;
    }
    if (def?.type === 'multiselect') {
      if (!Array.isArray(v)) return false;
      const need = Array.isArray(cond) ? cond : [cond];
      if (!need.every(x => v.includes(x))) return false;
      continue;
    }

    // text-like fallback: contains (fa locale)
    if (typeof cond === 'string') {
      if (!String(v ?? '').toLowerCase().includes(cond.toLowerCase())) return false;
      continue;
    }
  }
  return true;
}
