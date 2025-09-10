// app/api/table-select/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { resolveTable } from '@/lib/tableSelect-sources';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const qp = (u: URL, k: string) => (u.searchParams.get(k) ?? '').trim();

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const tableParam = qp(url, 'table') || 'fixedInformation';
    const type = qp(url, 'type'); // REQUIRED for FixedInformation
    const limit = Math.max(1, Math.min(500, parseInt(qp(url, 'limit') || '100', 10)));
    const q = qp(url, 'q');

    const table = resolveTable(tableParam);
    if (!table) {
      return NextResponse.json(
        { ok: false, message: `Unsupported table: ${tableParam}` },
        { status: 400 }
      );
    }
    if (!type) {
      return NextResponse.json(
        { ok: false, message: 'type is required for FixedInformation' },
        { status: 400 }
      );
    }

    // Build WHERE safely with params (identifiers cannot be parametrized; we resolved + quoted them)
    const params: any[] = [type];
    let whereSql = `WHERE type = $1`;
    if (q) {
      params.push(`%${q}%`);
      whereSql += ` AND title ILIKE $${params.length}`;
    }
    params.push(limit);

    const rows = await prisma.$queryRawUnsafe<{ code: string; title: string }[]>(
      `
        SELECT code, title
        FROM ${table}
        ${whereSql}
        ORDER BY title ASC
        LIMIT $${params.length}
      `,
      ...params
    );

    return NextResponse.json({
      ok: true,
      options: rows.map(r => ({
        value: r.code,       // what you store in the form payload
        label: r.title,      // what you display in the select
      })),
    });
  } catch (err: any) {
    console.error('TABLE-SELECT ERROR', err);
    return NextResponse.json({ ok: false, message: 'server error' }, { status: 500 });
  }
}
