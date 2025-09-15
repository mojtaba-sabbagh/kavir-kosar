import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim();
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));

  const where: Prisma.KardexItemWhereInput = q
    ? {
        OR: [
          { nameFa: { contains: q, mode: 'insensitive' as Prisma.QueryMode } },
          { code:   { contains: q, mode: 'insensitive' as Prisma.QueryMode } },
        ],
      }
    : {};

  const items = await prisma.kardexItem.findMany({
    where,
    orderBy: { nameFa: 'asc' },
    take: limit,
  });

  return NextResponse.json({
    ok: true,
    items: items.map(it => ({
      id: it.id,
      code: it.code,
      nameFa: it.nameFa,
      unit: it.unit ?? null,
      category: it.category ?? null,
    })),
  });
}
