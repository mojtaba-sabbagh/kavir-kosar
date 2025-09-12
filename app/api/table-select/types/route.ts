// app/api/table-select/types/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const table = (url.searchParams.get('table') || 'fixedInformation').trim();

    // Only allow the table we support
    if (table !== 'fixedInformation') {
      return NextResponse.json({ ok: false, message: 'Unsupported table' }, { status: 400 });
    }

    // Get distinct, non-empty types
    const rows = await prisma.fixedInformation.findMany({
      select: { type: true },
      where: { type: { not: '' } },
      distinct: ['type'],
      orderBy: { type: 'asc' },
      take: 1000,
    });

    const types = rows
      .map(r => r.type?.trim())
      .filter((t): t is string => !!t);

    return NextResponse.json({ ok: true, types });
  } catch (err: any) {
    console.error('types endpoint error:', err);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}
