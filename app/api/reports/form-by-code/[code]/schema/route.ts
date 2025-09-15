import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const params = await ctx.params;
  const form = await prisma.form.findUnique({
    where: { code: params.code },
    select: {
      id: true, code: true, titleFa: true,
      fields: { select: { key:true, labelFa:true, type:true, config:true, order:true } },
      report: true,
    }
  });
  if (!form) return NextResponse.json({ message:'not found' }, { status:404 });

  const fields = [...form.fields].sort((a,b)=>(a.order??0)-(b.order??0));
  return NextResponse.json({ form: { id: form.id, code: form.code, titleFa: form.titleFa }, fields, config: form.report ?? null });
}
