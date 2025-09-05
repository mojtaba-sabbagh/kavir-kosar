import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code')!;
  const form = await prisma.form.findUnique({
    where: { code },
    select: {
      id: true, code: true,
      fields: { select: { key: true, type: true, labelFa: true, config: true } }
    }
  });
  return NextResponse.json(form ?? { message: 'not found' });
}
