// app/api/reports/kardex/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  await requireAdmin(); // throws if not admin

  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim();

  const items = await prisma.kardexItem.findMany({
    where: q
      ? {
          OR: [
            { code: { contains: q, mode: 'insensitive' } },
            { nameFa: { contains: q, mode: 'insensitive' } },
          ],
        }
      : undefined,
    orderBy: [{ nameFa: 'asc' }, { code: 'asc' }],
    take: 200,
  });

  return NextResponse.json({ ok: true, items });
}
