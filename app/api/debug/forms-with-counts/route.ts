// app/api/debug/forms-with-counts/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const forms = await prisma.form.findMany({
    select: {
      id: true, code: true, titleFa: true,
      _count: { select: { entries: true } },
    },
    orderBy: { code: 'asc' },
  });
  return NextResponse.json({ forms });
}
