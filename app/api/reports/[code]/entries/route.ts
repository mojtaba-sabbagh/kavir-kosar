import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireReportView } from '@/lib/reports-guard';
import { resolveTable } from '@/lib/tableSelect-sources';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const IDENT_SAFE = /^[a-zA-Z0-9_]+$/;
const qp = (url: URL, k: string) => (url.searchParams.get(k) ?? '').trim();

export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code: raw } = await ctx.params;
    const decoded = decodeURIComponent(raw || '');

    // Detect auto report without altering case for DB lookups
    const isAuto = decoded.toUpperCase().startsWith('RPT:FORM:');
    const formCode = isAuto ? decoded.slice('RPT:FORM:'.length) : decoded;

    // Use uppercase **only** for the permission guard
    const guardCode = (isAuto ? `RPT:FORM:${formCode}` : formCode).toUpperCase();

    // Guard
    try {
      await requireReportView(guardCode);
    } catch (e: any) {
      const msg = e?.message || 'FORBIDDEN';
      const status = msg === 'UNAUTHORIZED' ? 401 : msg === 'NOT_FOUND' ? 404 : 403;
      return NextResponse.json({ ok: false, message: 'دسترسی غیرمجاز' }, { status });
    }

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(5, parseInt(url.searchParams.get('pageSize') || '20', 10)));
    const text = (url.searchParams.get('q') ?? '').trim();
    const orderKey = (url.searchParams.get('order') ?? 'createdAt').trim();
    const dir = ((url.searchParams.get('dir') ?? 'desc').trim().toLowerCase() === 'asc') ? 'ASC' : 'DESC';

    // IMPORTANT: lookup form by **original-case** code
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
    if (!form) {
      return NextResponse.json({ ok: false, message: 'فرم یافت نشد' }, { status: 404 });
    }

    const report = await prisma.report.findFirst({ where: { formId: form.id } });
    const visibleColumns: string[] = report?.visibleColumns ?? [];
    const filterableKeys: string[] = report?.filterableKeys ?? [];
    const orderableKeys: string[] = report?.orderableKeys ?? [];
    const defaultOrder = (report?.defaultOrder as any) ?? null;

    // --- helpers built from schema
    const typeByKey: Record<string, string> = {};
    const labels: Record<string, string> = {};
    form.fields.forEach(f => { typeByKey[f.key] = f.type; labels[f.key] = f.labelFa; });

    // --- display maps: select/multiselect options
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

    // --- schema for client
    const schema = form.fields.map(f => ({
      key: f.key,
      type: f.type,
      config: f.config || {},
    }));

    // ---------- WHERE (raw SQL with params) ----------
    const params: any[] = [];
    let whereSql = `fe."formId" = $1`;
    params.push(form.id);

    // collect date/datetime ranges to handle casting cleanly
    const dtRanges: Record<string, { from?: string; to?: string }> = {};

    // immediate filter handling (non-date)
    for (const [rawK, v] of url.searchParams.entries()) {
      if (!rawK.startsWith('filter_')) continue;
      if (!v) continue;

      let key = rawK.slice('filter_'.length);
      let bound: 'from' | 'to' | undefined;
      if (key.endsWith('_from')) { bound = 'from'; key = key.slice(0, -'_from'.length); }
      else if (key.endsWith('_to')) { bound = 'to'; key = key.slice(0, -'_to'.length); }

      if (!key || !IDENT_SAFE.test(key)) continue;
      const ftype = typeByKey[key];

      // dates are collected for a second pass
      if ((ftype === 'date' || ftype === 'datetime') && bound) {
        dtRanges[key] = dtRanges[key] || {};
        dtRanges[key][bound] = v;
        continue;
      }

      // kardexItem: search by nameFa/code => OR equals on JSON stored code(s)
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

      // tableSelect => equals on the stored code
      if (ftype === 'tableSelect') {
        params.push(key, v);
        whereSql += ` AND payload->>$${params.length - 1} = $${params.length}`;
        continue;
      }
        const codes = [...new Set(matches.map(m => m.code))];
        if (codes.length === 0) {
          // short-circuit empty
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
        // lock key placeholder
        params.push(key);
        const keyIdx = params.length;
        const col = `fe.payload->>$${keyIdx}`;
        const ors: string[] = [];
        for (const c of codes) {
          params.push(c);
          ors.push(`${col} = $${params.length}`);
        }
        whereSql += ` AND (${ors.join(' OR ')})`;
        continue;
      }

      // tableSelect: contains by title OR equals by code (user might type code)
      if (ftype === 'tableSelect') {
        // try to match titles (requires table/type from config)
        const ff = form.fields.find(f => f.key === key);
        const tcfg = (ff?.config as any)?.tableSelect || {};
        const tableName = resolveTable(tcfg.table);
        const tType = tcfg.type as string | undefined;

        if (tableName && tType) {
          const found = await prisma.$queryRawUnsafe<{ code: string }[]>(
            `
              SELECT code
              FROM ${tableName}
              WHERE type = $1 AND (title ILIKE $2 OR code ILIKE $2)
              LIMIT 200
            `,
            tType,
            `%${v}%`
          );
          const codes = [...new Set(found.map(r => r.code))];
          params.push(key);
          const keyIdx = params.length;
          const col = `fe.payload->>$${keyIdx}`;
          if (codes.length) {
            const ors: string[] = [];
            for (const c of codes) { params.push(c); ors.push(`${col} = $${params.length}`); }
            // also allow the raw text to equal code directly
            params.push(v);
            ors.push(`${col} = $${params.length}`);
            whereSql += ` AND (${ors.join(' OR ')})`;
          } else {
            // fallback to contains on JSON string
            params.push(`%${v}%`);
            whereSql += ` AND ${col} ILIKE $${params.length}`;
          }
          continue;
        }
      }

      // generic contains on JSON text
      params.push(key, `%${v}%`);
      whereSql += ` AND fe.payload->>$${params.length - 1} ILIKE $${params.length}`;
    }

    // date/datetime ranges pass (casted)
    for (const [k, range] of Object.entries(dtRanges)) {
      const t = typeByKey[k];
      if (!t) continue;
      params.push(k);
      const keyIdx = params.length;

      if (t === 'date') {
        const col = `(fe.payload->>$${keyIdx})::date`;
        if (range.from) { params.push(range.from.slice(0, 10)); whereSql += ` AND ${col} >= $${params.length}::date`; }
        if (range.to)   { params.push(range.to.slice(0, 10));   whereSql += ` AND ${col} <= $${params.length}::date`; }
      } else {
        const col = `(fe.payload->>$${keyIdx})::timestamptz`;
        if (range.from) { params.push(range.from); whereSql += ` AND ${col} >= $${params.length}::timestamptz`; }
        if (range.to)   { params.push(range.to);   whereSql += ` AND ${col} <= $${params.length}::timestamptz`; }
      }
    }

    // optional global text over filterableKeys (text-ish)
    if (text && filterableKeys.length) {
      const ors: string[] = [];
      for (const k of filterableKeys) {
        if (!IDENT_SAFE.test(k)) continue;
        const t = typeByKey[k] || 'text';
        if (t === 'text' || t === 'textarea' || t === 'select' || t === 'kardexItem' || t === 'tableSelect') {
          params.push(k);
          params.push(`%${text}%`);
          ors.push(`fe.payload->>$${params.length - 1} ILIKE $${params.length}`);
        }
      }
      if (ors.length) whereSql += ` AND (${ors.join(' OR ')})`;
    }

    // ---------- COUNT ----------
    const countRows = await prisma.$queryRawUnsafe<{ count: string }[]>(
      `SELECT COUNT(*)::text AS count FROM "FormEntry" AS fe WHERE ${whereSql}`,
      ...params
    );
    const total = parseInt(countRows?.[0]?.count || '0', 10);

    // ---------- ORDER BY (+ optional JOINs for label-based sorts) ----------
    let joinSql = '';
    let orderSql = `fe."createdAt" ${dir}`;

    if (orderKey !== 'createdAt' && orderableKeys.includes(orderKey) && IDENT_SAFE.test(orderKey)) {
      const kType = typeByKey[orderKey];

      if (kType === 'date' || kType === 'datetime') {
        orderSql = `(fe.payload->>'${orderKey}')::timestamptz ${dir}, fe."createdAt" DESC`;
      } else if (kType === 'kardexItem') {
        joinSql += ` LEFT JOIN "KardexItem" AS ki__ord ON ki__ord."code" = fe.payload->>'${orderKey}'`;
        orderSql = `COALESCE(ki__ord."nameFa", fe.payload->>'${orderKey}') ${dir}, fe."createdAt" DESC`;
      } else if (kType === 'tableSelect') {
        const ff = form.fields.find(f => f.key === orderKey);
        const tcfg = (ff?.config as any)?.tableSelect || {};
        const tableName = resolveTable(tcfg.table);
        const alias = `ts__ord`;
        if (tableName) {
          joinSql += ` LEFT JOIN ${tableName} AS ${alias} ON ${alias}."code" = fe.payload->>'${orderKey}'`;
          orderSql = `COALESCE(${alias}."title", fe.payload->>'${orderKey}') ${dir}, fe."createdAt" DESC`;
        } else {
          orderSql = `COALESCE(NULLIF(fe.payload->>'${orderKey}', ''), '') ${dir}, fe."createdAt" DESC`;
        }
      } else {
        orderSql = `COALESCE(NULLIF(fe.payload->>'${orderKey}', ''), '') ${dir}, fe."createdAt" DESC`;
      }
    }

    // ---------- PAGE + SELECT ----------
    params.push(pageSize, (page - 1) * pageSize);
    const rows = await prisma.$queryRawUnsafe<
      { id: string; createdAt: Date; status: string; payload: any }[]
    >(
      `
        SELECT fe.id, fe."createdAt", fe.status, fe.payload
        FROM "FormEntry" AS fe
        ${joinSql}
        WHERE ${whereSql}
        ORDER BY ${orderSql}
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `,
      ...params
    );

    // ---------- display maps for tableSelect (code -> title) ----------
    const tableSelectFields = form.fields
      .filter(f => f.type === 'tableSelect' && (f.config as any)?.tableSelect?.table && (f.config as any)?.tableSelect?.type)
      .map(f => ({ key: f.key, table: (f.config as any).tableSelect.table as string, type: (f.config as any).tableSelect.type as string }));

    for (const tf of tableSelectFields) {
      const codes = new Set<string>();
      for (const r of rows) {
        const v = r.payload?.[tf.key];
        if (typeof v === 'string' && v) codes.add(v);
      }
      if (!codes.size) continue;

      const tableName = resolveTable(tf.table);
      if (!tableName) continue;

      const items = await prisma.$queryRawUnsafe<{ code: string; title: string }[]>(
        `
          SELECT code, title
          FROM ${tableName}
          WHERE type = $1 AND code = ANY($2::text[])
        `,
        tf.type,
        Array.from(codes)
      );

      displayMaps[tf.key] = displayMaps[tf.key] || {};
      for (const it of items) displayMaps[tf.key][it.code] = it.title;
    }

    // ---------- display maps for kardexItem (code -> "nameFa – code") ----------
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
