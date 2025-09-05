import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { normalizeFa } from '@/lib/fa-normalize';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get('q') ?? '';
  const q = raw.trim();
  if (!q) return NextResponse.json({ items: [] });

  const nq = normalizeFa(q);

  // Build OR filters using both raw & normalized, for name and code.
  const orName = [
    { nameFa: { contains: q,  mode: 'insensitive' as const } },
    { nameFa: { contains: nq, mode: 'insensitive' as const } },
  ];

  const orCode = [
    { code: { contains: q,  mode: 'insensitive' as const } },
    { code: { contains: nq, mode: 'insensitive' as const } },
  ];

  const rows = await prisma.kardexItem.findMany({
    where: { OR: [...orName, ...orCode] },
    orderBy: [{ nameFa: 'asc' }],
    take: 20,
    select: { id: true, code: true, nameFa: true, unit: true },
  });

  return NextResponse.json({ items: rows });
}
