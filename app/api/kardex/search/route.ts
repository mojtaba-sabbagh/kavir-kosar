import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { canReadReport } from '@/lib/reports';

export async function GET(req: Request) {
  // Accept users who can read the Kardex report
  const ok = await canReadReport('KARDEX');
  if (!ok) return NextResponse.json({ items: [] });

  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim();
  if (!q) return NextResponse.json({ items: [] });

  const items = await prisma.kardexItem.findMany({
    where: { OR: [{ code: { contains: q } }, { nameFa: { contains: q } }] },
    take: 20,
    orderBy: [{ nameFa: 'asc' }, { code: 'asc' }],
    select: { id: true, code: true, nameFa: true, unit: true },
  });

  return NextResponse.json({
    items: items.map(i => ({ id: i.id, code: i.code, nameFa: i.nameFa, unit: i.unit })),
  });
}
