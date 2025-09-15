import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/rbac';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Accept absolute URL OR a site-relative path starting with "/"
const UrlLike = z
  .string()
  .trim()
  .nullable()
  .optional()
  .refine((v) => {
    if (v == null || v === '') return true;
    if (v.startsWith('/')) return true; // allow relative paths
    try { new URL(v); return true; } catch { return false; }
  }, 'invalid url');

// Coerce sortOrder to an integer (handles "123" strings)
const IntCoerce = z.preprocess(
  (v) => (typeof v === 'string' ? Number(v) : v),
  z.number().int()
);

const updateSchema = z.object({
  code: z.string().min(2),
  titleFa: z.string().min(2),
  url: UrlLike,
  sortOrder: IntCoerce,
  isActive: z.boolean(),
});

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try { await requireAdmin(); } catch (e:any) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز' }, { status: e?.message === 'UNAUTHORIZED' ? 401 : 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    // optional: log parsed.error for debugging
    return NextResponse.json({ message: 'ورودی نامعتبر' }, { status: 422 });
  }

  const data = parsed.data;
  const params = await ctx.params;
  // prevent duplicate codes (except same record)
  const dup = await prisma.report.findUnique({ where: { code: data.code } });
  if (dup && dup.id !== params.id) {
    return NextResponse.json({ message: 'کد گزارش تکراری است' }, { status: 409 });
  }

  const report = await prisma.report.update({
    where: { id: params.id },
    data: {
      code: data.code,
      titleFa: data.titleFa,
      url: data.url && data.url.trim() !== '' ? data.url : null,
      sortOrder: data.sortOrder,
      isActive: data.isActive,
    },
  });

  return NextResponse.json({ report });
}

/* You already have POST (with _method=DELETE) below; keep it as-is. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try { await requireAdmin(); } catch (e:any) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز' }, { status: e?.message === 'UNAUTHORIZED' ? 401 : 403 });
  }
  const params = await ctx.params;
  const url = new URL(req.url);
  let override = url.searchParams.get('_method');
  if (!override && req.headers.get('content-type')?.includes('form')) {
    try { override = (await req.formData()).get('_method') as string | null; } catch {}
  }

  if (override === 'DELETE') {
    await prisma.roleReportPermission.deleteMany({ where: { reportId: params.id } });
    await prisma.report.delete({ where: { id: params.id } });

    const redirectUrl = new URL('/admin/reports', req.url);
    return NextResponse.redirect(redirectUrl, { status: 303 });
  }

  return NextResponse.json({ message: 'Method Not Allowed' }, { status: 405 });
}
