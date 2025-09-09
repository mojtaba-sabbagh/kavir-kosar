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

    const report = await prisma.report.findFirst({ where: { formId: form.id } });
    const visibleColumns: string[] = report?.visibleColumns ?? [];
    const filterableKeys: string[] = report?.filterableKeys ?? [];
    const orderableKeys: string[] = report?.orderableKeys ?? [];
    const defaultOrder = (report?.defaultOrder as any) ?? null;

    // Labels
    const labels: Record<string, string> = {};
    for (const f of form.fields) labels[f.key] = f.labelFa;

    // Display maps (select/multiselect options)
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

    // Schema for client
    const schema = form.fields.map(f => ({
      key: f.key,
      type: f.type,
      config: f.config || {},
    }));

    // ---------- WHERE builder (raw SQL with params) ----------
    const params: any[] = [];
    let whereSql = `"formId" = $1`;
    params.push(form.id);

    // Collect date/datetime ranges separately so we don't accidentally add ILIKE for _from/_to
    const dtRanges: Record<string, { from?: string; to?: string }> = {};

    for (const [rawK, v] of url.searchParams.entries()) {
      if (!rawK.startsWith('filter_')) continue;
      if (!v) continue;

      // ✅ parse key & bound without breaking on inner underscores
      let key = rawK.slice('filter_'.length); // strip `filter_`
      let bound: 'from' | 'to' | undefined;
      if (key.endsWith('_from')) { bound = 'from'; key = key.slice(0, -'_from'.length); }
      else if (key.endsWith('_to')) { bound = 'to'; key = key.slice(0, -'_to'.length); }

      if (!key || !IDENT_SAFE.test(key)) continue;

      const ftype = typeByKey[key];

      // --- Date / Datetime: collect into dtRanges; skip generic clause
      if ((ftype === 'date' || ftype === 'datetime') && bound) {
        dtRanges[key] = dtRanges[key] || {};
        dtRanges[key][bound] = v;
        continue;
      }

      // --- Kardex: translate user text to codes and generate OR equals chain
      // --- Kardex: translate text -> codes and append an OR-equals group immediately
    if (ftype === 'kardexItem') {
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
        // no match => empty result
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

      // Push the JSON path key now and record its index
      params.push(key);
      const keyIdx = params.length;                          // ← index for the key
      const col = `payload->>$${keyIdx}`;

      // Build (col = $idx OR col = $idx ...)
      const parts: string[] = [];
      for (const c of codes) {
        params.push(c);
        const valIdx = params.length;                        // ← index for this code
        parts.push(`${col} = $${valIdx}`);
      }
      whereSql += ` AND (${parts.join(' OR ')})`;
      continue;
    }


  // --- Generic (non-date) contains on JSON text
  params.push(key, `%${v}%`);
  whereSql += ` AND payload->>$${params.length - 1} ILIKE $${params.length}`;
}


    // 2) Apply date/datetime ranges in a dedicated pass
    for (const [k, range] of Object.entries(dtRanges)) {
      const t = typeByKey[k];
      if (!t) continue;

      // Lock placeholder for JSON key
      params.push(k);
      const keyIdx = params.length;

      if (t === 'date') {
        const col = `(payload->>$${keyIdx})::date`;
        if (range.from) {
          params.push(range.from.slice(0, 10));
          whereSql += ` AND ${col} >= $${params.length}::date`;
        }
        if (range.to) {
          params.push(range.to.slice(0, 10));
          whereSql += ` AND ${col} <= $${params.length}::date`;
        }
      } else {
        const col = `(payload->>$${keyIdx})::timestamptz`;
        if (range.from) {
          params.push(range.from);
          whereSql += ` AND ${col} >= $${params.length}::timestamptz`;
        }
        if (range.to) {
          params.push(range.to);
          whereSql += ` AND ${col} <= $${params.length}::timestamptz`;
        }
      }
    }

    // 3) Optional global text across filterableKeys
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

    // ---------- COUNT ----------
    const countRows = await prisma.$queryRawUnsafe<{ count: string }[]>(
      `SELECT COUNT(*)::text AS count FROM "FormEntry" WHERE ${whereSql}`,
      ...params
    );
    const total = parseInt(countRows?.[0]?.count || '0', 10);

    // --- ORDER BY (and an optional JOIN when ordering by kardexItem) ---
    let joinSql = '';
    let orderSql = `"createdAt" ${dir}`; // default

    if (orderKey !== 'createdAt' && orderableKeys.includes(orderKey) && IDENT_SAFE.test(orderKey)) {
      const kType = typeByKey[orderKey];

      if (kType === 'date' || kType === 'datetime') {
        orderSql = `(payload->>'${orderKey}')::timestamptz ${dir}, "createdAt" DESC`;
      } else if (kType === 'kardexItem') {
        // Sort by KardexItem.nameFa when present; otherwise by the stored code
        joinSql = `LEFT JOIN "KardexItem" AS ki__ord ON ki__ord."code" = payload->>'${orderKey}'`;
        orderSql = `COALESCE(ki__ord."nameFa", payload->>'${orderKey}') ${dir}, "createdAt" DESC`;
      } else {
        // lexical sort on the string value
        orderSql = `COALESCE(NULLIF(payload->>'${orderKey}', ''), '') ${dir}, "createdAt" DESC`;
      }
    }

    // --- Page + Select ---
    params.push(pageSize, (page - 1) * pageSize);
    const rows = await prisma.$queryRawUnsafe<
      { id: string; createdAt: Date; status: string; payload: any }[]
    >(
      `
        SELECT fe.id, fe."createdAt", fe.status, fe.payload
        FROM "FormEntry" AS fe
        ${joinSql}
        WHERE ${whereSql.replaceAll(`"FormId"`, `fe."FormId"`).replaceAll(`"formId"`, `fe."formId"`)}
        ORDER BY ${orderSql}
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `,
      ...params
    );

    //console.log(whereSql);
    //console.log(params);

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

    // Optional debug echo
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
    });
  } catch (err: any) {
    console.error('REPORT ENTRIES API ERROR:', err);
    return NextResponse.json({ ok: false, message: 'خطای سرور' }, { status: 500 });
  }
}
