// app/api/reports/[code]/entries/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireReportView } from '@/lib/reports-guard';
import { resolveTable } from '@/lib/tableSelect-sources';
import { cookies, headers } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const IDENT_SAFE = /^[a-zA-Z0-9_\-]+$/;

// ---------- small helpers ----------
const qp = (url: URL, k: string) => (url.searchParams.get(k) ?? '').trim();

async function readCookie(name: string): Promise<string | null> {
  try {
    const jar = await cookies();
    const hit = jar.get(name);
    return hit?.value ?? null;
  } catch {
    return null;
  }
}

function base64UrlToUtf8(b64url: string): string {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4;
  const padded = pad ? b64 + '='.repeat(4 - pad) : b64;
  return Buffer.from(padded, 'base64').toString('utf8');
}

function decodeJwtNoVerify(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payloadJson = base64UrlToUtf8(parts[1]);
    return JSON.parse(payloadJson);
  } catch {
    return null;
  }
}

// get logged-in user id (best-effort; no redirect/throw)
async function getOptionalUserId(): Promise<string | null> {
  // 1) JWT session cookie (primary method)
  const sess = await readCookie('session');
  if (sess) {
    const payload = decodeJwtNoVerify(sess);
    if (payload?.sub) return String(payload.sub);

    // Optional fallback: resolve by email
    if (payload?.email) {
      const u = await prisma.user.findUnique({
        where: { email: String(payload.email) },
        select: { id: true },
      });
      if (u?.id) return u.id;
    }
  }

  // 2) Common id cookie fallbacks (add/adjust as needed)
  const fallbackCookieNames = ['sessionUserId', 'uid', 'userId', 'auth_user_id', 'userid'];
  for (const k of fallbackCookieNames) {
    const v = await readCookie(k); // Added await here
    if (v) return v;
  }

  // 3) Proxy headers (if you ever set them)
  const h = await headers(); // Added await here
  const hdr = h.get('x-user-id') || h.get('x-auth-user-id') || h.get('x-user');
  if (hdr) return hdr;

  return null;
}
// RBAC: does this user have any role that canSubmit on this form?
async function userCanSubmitOnForm(userId: string, formId: string): Promise<boolean> {
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    select: { roleId: true },
  });
  if (userRoles.length === 0) return false;
  const roleIds = userRoles.map((ur) => ur.roleId);

  const hit = await prisma.roleFormPermission.findFirst({
    where: { formId, canSubmit: true, roleId: { in: roleIds } },
    select: { id: true },
  });
  return !!hit;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }  // params is now Promise
) {
  try {
    // Access params through context
    const param = await context.params;
    const raw = param.code;
    const decoded = decodeURIComponent(raw || '');

    // Detect auto report without altering case for DB lookups
    const isAuto = decoded.toUpperCase().startsWith('RPT:FORM:');
    const formCode = isAuto ? decoded.slice('RPT:FORM:'.length) : decoded;

    // Guard (your guard handles the case)
    const guardCode = isAuto ? `RPT:FORM:${formCode}` : formCode;
    try {
      await requireReportView(guardCode);
    } catch (e: any) {
      const msg = e?.message || 'FORBIDDEN';
      const status = msg === 'UNAUTHORIZED' ? 401 : msg === 'NOT_FOUND' ? 404 : 403;
      return NextResponse.json({ ok: false, message: 'دسترسی غیرمجاز' }, { status });
    }

    const url = new URL(req.url);
    const DEBUG = url.searchParams.get('debug') === '1';

    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(5, parseInt(url.searchParams.get('pageSize') || '20', 10)));
    const text = (url.searchParams.get('q') ?? '').trim();
    const orderKey = (url.searchParams.get('order') ?? 'createdAt').trim();
    const dir = ((url.searchParams.get('dir') ?? 'desc').trim().toLowerCase() === 'asc') ? 'ASC' : 'DESC';

    // Lookup form by original-case code
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

    // Compute canSubmit (aka canSend) for this user on this form
    let canSubmit = false;
    const userId = await getOptionalUserId();
    if (userId) {
      try {
        canSubmit = await userCanSubmitOnForm(userId, form.id);
      } catch {
        canSubmit = false;
      }
    }
    const debugBag = DEBUG
      ? {
          userId: userId ?? null,
          cookieNames: (await cookies()).getAll().map((c) => c.name),
        }
      : undefined;

    const report = await prisma.report.findFirst({ where: { formId: form.id } });
// Get form fields sorted by order
const sortedFormFields = form.fields.sort((a, b) => (a.order || 0) - (b.order || 0));

// Create a map for quick lookup of field order
const fieldOrderMap = new Map<string, number>();
sortedFormFields.forEach(field => {
  fieldOrderMap.set(field.key, field.order || 0);
});

// Filter and sort visibleColumns by form field order
let visibleColumns: string[] = [];
if (report?.visibleColumns && report.visibleColumns.length > 0) {
  // Filter to only include fields that exist in the form
  visibleColumns = report.visibleColumns
    .filter(key => fieldOrderMap.has(key))
    .sort((a, b) => {
      const orderA = fieldOrderMap.get(a) || 0;
      const orderB = fieldOrderMap.get(b) || 0;
      return orderA - orderB;
    });
} else {
  // If no visibleColumns defined, use all form fields in order
  visibleColumns = sortedFormFields.map(f => f.key);
}

const filterableKeys: string[] = report?.filterableKeys ?? [];
const orderableKeys: string[] = report?.orderableKeys ?? [];
const defaultOrder = (report?.defaultOrder as any) ?? null;

// helpers from schema
const typeByKey: Record<string, string> = {};
const labels: Record<string, string> = {};
for (const f of form.fields) {
  typeByKey[f.key] = f.type as unknown as string;
  labels[f.key] = f.labelFa;
}

// display maps for select/multiselect (from static options in config)
const displayMaps: Record<string, Record<string, string>> = {};
for (const f of form.fields) {
  const cfg = (f.config ?? {}) as any;
  const opts: Array<{ value: string; label?: string }> = Array.isArray(cfg.options) ? cfg.options : [];
  if (opts.length) {
    displayMaps[f.key] = {};
    for (const o of opts) {
      if (o && o.value != null) displayMaps[f.key][String(o.value)] = String(o.label ?? o.value);
    }
  }
}

// schema for client - INCLUDE ORDER FIELD and only include visible columns
const schema = form.fields
  .filter(f => visibleColumns.includes(f.key)) // Only include visible fields
  .map((f) => ({
    key: f.key,
    type: f.type,
    config: f.config || {},
    order: f.order || 0, // Default to 0 if undefined
  }))
  .sort((a, b) => (a.order || 0) - (b.order || 0)); // Sort by order

    // ---------- WHERE (filters) ----------
    const params: any[] = [];
    let whereSql = `fe."formId" = $1`;
    params.push(form.id);

    // collect date/datetime ranges
    const dtRanges: Record<string, { from?: string; to?: string }> = {};

    for (const [rawK, v] of url.searchParams.entries()) {
      if (!rawK.startsWith('filter_')) continue;
      if (!v) continue;

      let key = rawK.slice('filter_'.length);
      let bound: 'from' | 'to' | undefined;
      if (key.endsWith('_from')) {
        bound = 'from';
        key = key.slice(0, -'_from'.length);
      } else if (key.endsWith('_to')) {
        bound = 'to';
        key = key.slice(0, -'_to'.length);
      }

      if (!key || !IDENT_SAFE.test(key)) continue;
      const ftype: string = (typeByKey[key] as string) || '';

      // date/datetime collected for second pass
      if ((ftype === 'date' || ftype === 'datetime') && bound) {
        dtRanges[key] = dtRanges[key] || {};
        dtRanges[key][bound] = v;
        continue;
      }

      // kardexItem: match code OR name, then equals on JSON value
      if (ftype === 'kardexItem') {
        const matches = await prisma.kardexItem.findMany({
          where: {
            OR: [
              { nameFa: { contains: v, mode: 'insensitive' } },
              { code: { contains: v, mode: 'insensitive' } },
            ],
          },
          select: { code: true },
          take: 200,
        });

        const codes = [...new Set(matches.map((m) => m.code))];
        if (codes.length === 0) {
          // short-circuit empty
          return NextResponse.json({
            ok: true,
            meta: {
              formCode: form.code,
              titleFa: form.titleFa,
              page,
              pageSize,
              total: 0,
              visibleColumns,
              filterableKeys,
              orderableKeys,
              defaultOrder,
              orderApplied: orderKey === 'createdAt' ? 'createdAt' : orderKey,
              canSubmit,
              ...(DEBUG ? { _debug: debugBag } : {}),
            },
            labels,
            rows: [],
            displayMaps,
            schema,
          });
        }

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

      // tableSelect: try join table title/code lookup by configured table/type
      if (ftype === 'tableSelect') {
        const ff = form.fields.find((f) => f.key === key);
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
          const codes = [...new Set(found.map((r) => r.code))];

          params.push(key);
          const keyIdx = params.length;
          const col = `fe.payload->>$${keyIdx}`;
          if (codes.length) {
            const ors: string[] = [];
            for (const c of codes) {
              params.push(c);
              ors.push(`${col} = $${params.length}`);
            }
            // also allow direct code equality with the typed value
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

    // date/datetime second pass (casted)
    for (const [k, range] of Object.entries(dtRanges)) {
      const t = typeByKey[k];
      if (!t) continue;
      params.push(k);
      const keyIdx = params.length;

      if (t === 'date') {
        const col = `(fe.payload->>$${keyIdx})::date`;
        if (range.from) {
          params.push(range.from.slice(0, 10));
          whereSql += ` AND ${col} >= $${params.length}::date`;
        }
        if (range.to) {
          params.push(range.to.slice(0, 10));
          whereSql += ` AND ${col} <= $${params.length}::date`;
        }
      } else {
        const col = `(fe.payload->>$${keyIdx})::timestamptz`;
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

    // optional global text search over filterableKeys (text-ish)
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

    // ---------- ORDER (+ optional JOINs for label-based sorts) ----------
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
        const ff = form.fields.find((f) => f.key === orderKey);
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
      .filter(
        (f) =>
          f.type === 'tableSelect' &&
          (f.config as any)?.tableSelect?.table &&
          (f.config as any)?.tableSelect?.type
      )
      .map((f) => ({
        key: f.key,
        table: (f.config as any).tableSelect.table as string,
        type: (f.config as any).tableSelect.type as string,
        order: f.order, // Add this if needed
      }));

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
    const kardexKeys = form.fields.filter((f) => f.type === 'kardexItem').map((f) => f.key);
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
        page,
        pageSize,
        total,
        visibleColumns,
        filterableKeys,
        orderableKeys,
        defaultOrder,
        orderApplied: orderKey === 'createdAt' ? 'createdAt' : orderKey,
        canSubmit,
        ...(DEBUG ? { _debug: debugBag } : {}),
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
