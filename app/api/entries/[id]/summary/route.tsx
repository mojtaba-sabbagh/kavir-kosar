// app/api/entries/[id]/summary/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { resolveTable } from '@/lib/tableSelect-sources';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type TableSelectCfg = { table?: string; type?: string };

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;

    const entry = await prisma.formEntry.findUnique({
      where: { id },
      select: { id: true, createdAt: true, status: true, payload: true, formId: true },
    });
    if (!entry) return NextResponse.json({ ok: false, message: 'یافت نشد' }, { status: 404 });

    const form = await prisma.form.findUnique({
      where: { id: entry.formId },
      select: {
        code: true,
        titleFa: true,
        fields: { select: { key: true, labelFa: true, type: true, config: true, order: true }, orderBy: { order: 'asc' } },
      },
    });
    if (!form) return NextResponse.json({ ok: false, message: 'فرم یافت نشد' }, { status: 404 });

    const labels: Record<string, string> = {};
    const schema = form.fields.map(f => ({ key: f.key, type: f.type, config: f.config || {} }));
    for (const f of form.fields) labels[f.key] = f.labelFa;

    // Build display maps
    const displayMaps: Record<string, Record<string, string>> = {};

    // 1) select / multiselect
    for (const f of form.fields) {
      const cfg = (f.config ?? {}) as any;
      const opts = Array.isArray(cfg.options) ? cfg.options : [];
      if (opts.length) {
        displayMaps[f.key] = {};
        for (const o of opts) {
          if (o && o.value != null) {
            displayMaps[f.key][String(o.value)] = String(o.label ?? o.value);
          }
        }
      }
    }

    // 2) tableSelect (code -> title)
    const tableSelectFields = form.fields
      .map(f => {
        const cfg = (f.config ?? {}) as Record<string, any>;
        const ts: TableSelectCfg = (cfg.tableSelect ?? {}) as TableSelectCfg;
        return {
          key: f.key,
          table: ts.table,
          type: ts.type,
          _valid: f.type === 'tableSelect' && !!ts.table && !!ts.type,
        };
      })
      .filter(f => f._valid)
      .map(f => ({ key: f.key, table: f.table as string, type: f.type as string }));

    const payload = (entry.payload ?? {}) as Record<string, unknown>
    for (const tf of tableSelectFields) {
      const raw = payload[tf.key];
      if (!raw) continue;
      const codes = Array.isArray(raw)
        ? (raw as unknown[]).filter(Boolean).map(String)
        : [String(raw)];

      if (codes.length) {
        const tableName = resolveTable(tf.table);
        if (tableName) {
          const items = await prisma.$queryRawUnsafe<{ code: string; title: string }[]>(
            `SELECT code, title FROM ${tableName} WHERE type = $1 AND code = ANY($2::text[])`,
            tf.type,
            codes
          );
          displayMaps[tf.key] = displayMaps[tf.key] || {};
          for (const it of items) displayMaps[tf.key][it.code] = it.title;
        }
      }
    }

    // 3) kardexItem (code -> "nameFa – code")
    const kardexKeys = form.fields.filter(f => f.type === 'kardexItem').map(f => f.key);
if (kardexKeys.length) {
  const payload = (entry.payload ?? {}) as Record<string, unknown>; // ✅ cast once
  const codes = new Set<string>();

  for (const k of kardexKeys) {
    const v = payload[k];
    // accept string, or coerce other primitives safely
    if (typeof v === 'string' && v) {
      codes.add(v);
    } else if (v != null && typeof v !== 'object') {
      // number/boolean, etc. → string
      const s = String(v);
      if (s) codes.add(s);
    }
  }      
      
      if (codes.size) {
        const items = await prisma.kardexItem.findMany({
          where: { code: { in: Array.from(codes) } },
          select: { code: true, nameFa: true },
        });
        for (const k of kardexKeys) {
          displayMaps[k] = displayMaps[k] || {};
          for (const it of items) displayMaps[k][it.code] = `${it.nameFa} – ${it.code}`;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      id: entry.id,
      formCode: form.code,
      formTitle: form.titleFa,
      createdAt: entry.createdAt,
      status: entry.status,
      payload: entry.payload ?? {},
      labels,
      schema,
      displayMaps,
    });
  } catch (e) {
    console.error('ENTRY SUMMARY ERROR:', e);
    return NextResponse.json({ ok: false, message: 'خطای سرور' }, { status: 500 });
  }
}
