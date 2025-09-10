import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// simple resolver – only one table for now
const resolveTable = (name: string) => {
  if (name === 'FixedInformation') return '"FixedInformation"';
  return null;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const table = (url.searchParams.get('table') ?? 'FixedInformation').trim();
  const type  = (url.searchParams.get('type') ?? '').trim();

  const tableName = resolveTable(table);
  if (!tableName) return NextResponse.json({ ok: false, message: 'جدول نامعتبر' }, { status: 400 });

  const rows = await prisma.$queryRawUnsafe<{ code: string; title: string }[]>(
    `
      SELECT code, title
      FROM ${tableName}
      ${type ? 'WHERE type = $1' : ''}
      ORDER BY title ASC
    `,
    ...(type ? [type] as any[] : [])
  );

  const options = rows.map(r => ({ value: r.code, label: r.title }));
  return NextResponse.json({ ok: true, options });
}
