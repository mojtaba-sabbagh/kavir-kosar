import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim();
  const limit = Number(searchParams.get('limit') ?? 100);

  const where = q
    ? {
        OR: [
          { nameFa: { contains: q, mode: 'insensitive' } },
          { code: { contains: q, mode: 'insensitive' } },
        ],
      }
    : {}; // 👈 if no query, return all

  const items = await prisma.kardexItem.findMany({
    where,
    orderBy: { nameFa: 'asc' },
    take: limit,
  });

  return NextResponse.json({ items });
}
