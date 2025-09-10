import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/rbac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try { await requireAdmin(); } catch { return NextResponse.json({ message: 'دسترسی غیرمجاز' }, { status: 403 }); }

  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  const type = (url.searchParams.get('type') ?? '').trim();
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(5, parseInt(url.searchParams.get('pageSize') || '20', 10)));

  const where: any = {};
  if (q) where.title = { contains: q, mode: 'insensitive' };
  if (type) where.type = type;

  const [total, rows] = await Promise.all([
    prisma.fixedInformation.count({ where }),
    prisma.fixedInformation.findMany({
      where,
      orderBy: [{ type: 'asc' }, { title: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({ ok: true, total, rows });
}

export async function POST(req: Request) {
  try { await requireAdmin(); } catch { return NextResponse.json({ message: 'دسترسی غیرمجاز' }, { status: 403 }); }
  const body = await req.json().catch(() => null);
  if (!body || !body.code || !body.title || !body.type) {
    return NextResponse.json({ ok: false, message: 'کد، عنوان و نوع ضروری است' }, { status: 422 });
  }
  const row = await prisma.fixedInformation.create({
    data: { code: body.code, title: body.title, type: body.type, description: body.description ?? null },
  });
  return NextResponse.json({ ok: true, row });
}
