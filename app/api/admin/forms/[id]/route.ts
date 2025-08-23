import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/rbac';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const updateSchema = z.object({
  code: z.string().min(2, 'کد فرم باید حداقل ۲ کاراکتر باشد').optional(),
  titleFa: z.string().min(2, 'عنوان فارسی باید حداقل ۲ کاراکتر باشد').optional(),
  sortOrder: z.number().int('ترتیب نامعتبر است').optional(),
  isActive: z.boolean().optional(),
});

/** EDIT form */
export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> } // ⬅️ await params
) {
  try { await requireAdmin(); }
  catch (e: any) {
    const code = e?.message === 'UNAUTHORIZED' ? 401 : 403;
    return NextResponse.json({ message: 'دسترسی غیرمجاز' }, { status: code });
  }

  const { id } = await ctx.params;
  const json = await req.json();
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json({ message: issue?.message || 'ورودی نامعتبر' }, { status: 422 });
  }

  // Ensure form exists
  const existing = await prisma.form.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ message: 'فرم یافت نشد' }, { status: 404 });

  // Unique code check if code changes
  if (parsed.data.code && parsed.data.code !== existing.code) {
    const dup = await prisma.form.findUnique({ where: { code: parsed.data.code } });
    if (dup) return NextResponse.json({ message: 'کد فرم تکراری است' }, { status: 409 });
  }

  await prisma.form.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json({ ok: true });
}

/** DELETE (from a form POST with _method=DELETE) */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try { await requireAdmin(); }
  catch (e: any) {
    const code = e?.message === 'UNAUTHORIZED' ? 401 : 403;
    return NextResponse.json({ message: 'دسترسی غیرمجاز' }, { status: code });
  }

  const { id } = await ctx.params;

  // method override
  const url = new URL(req.url);
  let methodOverride: string | null = url.searchParams.get('_method');
  if (!methodOverride && req.headers.get('content-type')?.includes('form')) {
    try { methodOverride = (await req.formData()).get('_method') as string | null; } catch {}
  }

  if (methodOverride === 'DELETE') {
    await prisma.roleFormPermission.deleteMany({ where: { formId: id } });
    await prisma.form.delete({ where: { id } });

    const accepts = req.headers.get('accept') || '';
    if (accepts.includes('application/json')) return NextResponse.json({ ok: true });
    return NextResponse.redirect(new URL('/admin/forms', req.url), { status: 303 });
  }

  return NextResponse.json({ message: 'Method Not Allowed' }, { status: 405 });
}
