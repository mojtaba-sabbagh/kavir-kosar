import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireReportRead } from '@/lib/reports';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try { await requireReportRead('KARDEX'); }
  catch { return NextResponse.json({ message: 'دسترسی غیرمجاز' }, { status: 403 }); }

  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim();
  const take = Math.min(Number(url.searchParams.get('take') || 50), 200);
  const skip = Math.max(Number(url.searchParams.get('skip') || 0), 0);

  const where: any = {};
  if (q) where.nameFa = { contains: q };

  const [items, total] = await Promise.all([
    prisma.kardexItem.findMany({
      where,
      orderBy: [{ nameFa: 'asc' }, { code: 'asc' }],
      select: { id: true, code: true, nameFa: true, unit: true, category: true, currentQty: true, currentValue: true },
      take, skip,
    }),
    prisma.kardexItem.count({ where }),
  ]);

  return NextResponse.json({ items, total });
}
