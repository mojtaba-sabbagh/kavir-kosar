import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireReportView } from '@/lib/reports-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const IDENT_SAFE = /^[a-zA-Z0-9_]+$/;
const qp = (url: URL, k: string) => (url.searchParams.get(k) ?? '').trim();

export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code: raw } = await ctx.params;
    const decoded = decodeURIComponent(raw || '');
    const canonical = decoded.toUpperCase();
    const isAuto = canonical.startsWith('RPT:FORM:');
    const formCode = isAuto ? canonical.slice('RPT:FORM:'.length) : canonical;

    // Guard
    try {
      await requireReportView(canonical);
    } catch (e: any) {
      const msg = e?.message || 'FORBIDDEN';
      const status = msg === 'UNAUTHORIZED' ? 401 : msg === 'NOT_FOUND' ? 404 : 403;
      return NextResponse.json({ ok: false, message: 'دسترسی غیرمجاز' }, { status });
    }

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(5, parseInt(url.searchParams.get('pageSize') || '20', 10)));
    const text = qp(url, 'q');
    const orderKey = qp(url, 'order') || 'createdAt';
    const dir = (qp(url, 'dir') || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Load form + schema
    const form = await prisma.form.findFirst({
      where: { code: formCode },
      include: {
        report: true,
        fields: {
          select: { key: true, type: true, config: true, labelFa: true, order: true },
          orderBy: { order: 'asc' },
        },
      },
    });
    if (!form) return NextResponse.json({ ok: false, message: 'فرم یافت نشد' }, { status: 404 });
   

    const typeByKey: Record<string, string> = {};
    for (const f of form.fields) typeByKey[f.key] = f.type;
    // Load report
    const report = await prisma.report.findFirst({
      where: { formId: form.id },
    });
    const visibleColumns: string[] = report?.visibleColumns ?? [];
    const filterableKeys: string[] = report?.filterableKeys ?? [];
    const orderableKeys: string[] = report?.orderableKeys ?? [];
    const defaultOrder = (report?.defaultOrder as any) ?? null;
    console.log(report);
    // Labels
    const labels: Record<string, string> = {};
    for (const f of form.fields) labels[f.key] = f.labelFa;

    // Display maps (select options)
    const displayMaps: Record<string, Record<string, string>> = {};
    for (const f of form.fields) {
      const cfg = (f.config ?? {}) as any;
      const opts = Array.isArray(cfg.options) ? cfg.options : [];
      if (opts.length) {
        displayMaps[f.key] = {};
        for (const o of opts) {
          if (o && o.value != null) displayMaps[f.key][String(o.value)] = String(o.label ?? o.value);
        }
      }
    }

    // Prepare schema for client
    const schema = form.fields.map(f => ({
      key: f.key,
      type: f.type,
      config: f.config || {},
    }));

    // We will use raw SQL with parametrized values
    const params: any[] = [];
    let whereSql = `"formId" = $1`;
    params.push(form.id);

    // --- filter_<key>=value (with kardexItem special handling) ---
    const kardexSqlParts: string[] = [];
    const kardexSqlParams: any[] = [];

    for (const [k, v] of url.searchParams.entries()) {
      if (!k.startsWith('filter_')) continue;
      const key = k.slice('filter_'.length);
      if (!key || !IDENT_SAFE.test(key)) continue;
      if (!v) continue;

      const ftype = typeByKey[key];

      if (ftype === 'kardexItem') {
        // Translate user text to kardex codes (by nameFa or code)
        const matches = await prisma.kardexItem.findMany({
          where: {
            OR: [
              { nameFa: { contains: v, mode: 'insensitive' } },
              { code:   { contains: v, mode: 'insensitive' } },
            ],
          },
          select: { code: true },
          take: 200,
        });
        const codes = [...new Set(matches.map(m => m.code))];

        if (codes.length === 0) {
          // Short-circuit: no matches => empty result
          return NextResponse.json({
            ok: true,
            meta: {
              formCode: form.code, titleFa: form.titleFa,
              page, pageSize, total: 0,
              visibleColumns, filterableKeys, orderableKeys, defaultOrder,
              orderApplied: orderKey === 'createdAt' ? 'createdAt' : orderKey,
            },
            labels, rows: [], displayMaps, schema,
          });
        }

        // Build: (payload->>$n = $n+1 OR payload->>$n = $n+2 ...)
        kardexSqlParams.push(key);
        const col = `payload->>$${params.length + kardexSqlParams.length}`;
        const parts: string[] = [];
        for (const c of codes) {
          kardexSqlParams.push(c);
          parts.push(`${col} = $${params.length + kardexSqlParams.length}`);
        }
        kardexSqlParts.push(`(${parts.join(' OR ')})`);
      } else {
        // Non-kardex: JSON value contains (ILIKE)
        params.push(key, `%${v}%`);
        whereSql += ` AND payload->>$${params.length - 1} ILIKE $${params.length}`;
      }
    }

    // --- date/datetime ranges: filter_<key>_from / filter_<key>_to ---
for (const k of filterableKeys) {
  const t = typeByKey[k];
  if (t !== 'date' && t !== 'datetime') continue;

  const fromRaw = url.searchParams.get(`filter_${k}_from`) || '';
  const toRaw   = url.searchParams.get(`filter_${k}_to`)   || '';
  if (!fromRaw && !toRaw) continue;

  // Lock placeholder for the JSON path *once*
  params.push(k);
  const keyIdx = params.length;

  if (t === 'date') {
    // Compare by DATE (no time)
    const col = `(payload->>$${keyIdx})::date`;
    if (fromRaw) {
      params.push(fromRaw.slice(0, 10));                // YYYY-MM-DD
      whereSql += ` AND ${col} >= $${params.length}::date`;
    }
    if (toRaw) {
      params.push(toRaw.slice(0, 10));
      whereSql += ` AND ${col} <= $${params.length}::date`;
    }
  } else {
    // datetime: support both offset-aware and naive strings
    const col = `
      CASE
        WHEN (payload->>$${keyIdx}) ~* '(Z|[+-][0-9]{2}:[0-9]{2})$'
          THEN (payload->>$${keyIdx})::timestamptz
        ELSE (payload->>$${keyIdx})::timestamp AT TIME ZONE 'UTC'
      END
    `;
    if (fromRaw) {
      params.push(fromRaw);                              // already ISO with Z from client
      whereSql += ` AND ${col} >= $${params.length}::timestamptz`;
    }
    if (toRaw) {
      params.push(toRaw);
      whereSql += ` AND ${col} <= $${params.length}::timestamptz`;
    }
  }
}

    // --- optional global text across filterableKeys (text-ish only) ---
    if (text && filterableKeys.length) {
      const ors: string[] = [];
      for (const k of filterableKeys) {
        if (!IDENT_SAFE.test(k)) continue;
        const t = typeByKey[k] || 'text';
        if (t === 'text' || t === 'textarea' || t === 'select' || t === 'kardexItem') {
          params.push(k);
          params.push(`%${text}%`);
          ors.push(`payload->>$${params.length - 1} ILIKE $${params.length}`);
        }
      }
      if (ors.length) whereSql += ` AND (${ors.join(' OR ')})`;
    }

    // Merge kardex fragments
    if (kardexSqlParts.length) {
      whereSql += ` AND (${kardexSqlParts.join(' AND ')})`;
      params.push(...kardexSqlParams);
    }

    // --- Count with same WHERE ---
    const countRows = await prisma.$queryRawUnsafe<{ count: string }[]>(
      `SELECT COUNT(*)::text AS count FROM "FormEntry" WHERE ${whereSql}`,
      ...params
    );
    const total = parseInt(countRows?.[0]?.count || '0', 10);

    // --- ORDER BY ---
    let orderSql = `"createdAt" ${dir}`;
    if (orderKey !== 'createdAt' && orderableKeys.includes(orderKey) && IDENT_SAFE.test(orderKey)) {
      const kType = typeByKey[orderKey];
      if (kType === 'date' || kType === 'datetime') {
        orderSql = `(payload->>'${orderKey}')::timestamptz ${dir}, "createdAt" DESC`;
      } else {
        orderSql = `COALESCE(NULLIF(payload->>'${orderKey}', ''), '') ${dir}, "createdAt" DESC`;
      }
    }

    // --- Page + Select ---
    params.push(pageSize, (page - 1) * pageSize);
    const rows = await prisma.$queryRawUnsafe<
      { id: string; createdAt: Date; status: string; payload: any }[]
    >(
      `
        SELECT id, "createdAt", status, payload
        FROM "FormEntry"
        WHERE ${whereSql}
        ORDER BY ${orderSql}
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `,
      ...params
    );

    // Kardex display maps (code -> "nameFa – code")
    const kardexKeys = form.fields.filter(f => f.type === 'kardexItem').map(f => f.key);
    if (kardexKeys.length && rows.length) {
      const codes = new Set<string>();
      for (const r of rows) {
        const p = r.payload || {};
        for (const k of kardexKeys) {
          const v = p[k];
          if (typeof v === 'string' && v) codes.add(v);
        }
      }
      if (codes.size) {
        const items = await prisma.kardexItem.findMany({
          where: { code: { in: Array.from(codes) } },
          select: { code: true, nameFa: true },
        });
        const map: Record<string, string> = {};
        for (const it of items) map[it.code] = `${it.nameFa} – ${it.code}`;
        for (const k of kardexKeys) {
          displayMaps[k] = displayMaps[k] || {};
          for (const [c, lbl] of Object.entries(map)) displayMaps[k][c] = lbl;
        }
      }
    }

    // after computing whereSql, params, total, rows...
const isDebug = new URL(req.url).searchParams.get('debug') === '1';

return NextResponse.json({
  ok: true,
  meta: {
    formCode: form.code,
    titleFa: form.titleFa,
    page, pageSize, total,
    visibleColumns, filterableKeys, orderableKeys, defaultOrder, 
    orderApplied: orderKey === 'createdAt' ? 'createdAt' : orderKey,
  },
  labels,
  rows,
  displayMaps,
  schema,
  ...(isDebug ? {
  __debug: {
    whereSql,
    params,
    filterParams: {
      from: url.searchParams.get('filter_rasid_datetime_from'),
      to:   url.searchParams.get('filter_rasid_datetime_to'),
    }
  }
} : {})
});

  } catch (err: any) {
    console.error('REPORT ENTRIES API ERROR:', err);
    return NextResponse.json({ ok: false, message: 'خطای سرور' }, { status: 500 });
  }
}
