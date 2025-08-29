// app/api/admin/roles/[id]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/rbac';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const updateSchema = z.object({
  name: z.string().min(2, 'نام نقش باید حداقل ۲ کاراکتر باشد'),
});

// EDIT role
export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> }   // ⬅️ params is a Promise
) {
  try { await requireAdmin(); }
  catch (e: any) {
    const code = e?.message === 'UNAUTHORIZED' ? 401 : 403;
    return NextResponse.json({ message: 'دسترسی غیرمجاز' }, { status: code });
  }

  const { id } = await ctx.params;           // ⬅️ await the params
  const json = await req.json();
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json({ message: issue?.message || 'ورودی نامعتبر' }, { status: 422 });
  }

  const exists = await prisma.role.findFirst({
    where: { name: parsed.data.name, NOT: { id } },
  });
  if (exists) {
    return NextResponse.json({ message: 'نقشی با این نام قبلاً وجود دارد' }, { status: 409 });
  }

  await prisma.role.update({ where: { id }, data: { name: parsed.data.name } });
  return NextResponse.json({ ok: true });
}

// DELETE via method override
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }   // ⬅️ also async here
) {
  try { await requireAdmin(); }
  catch (e: any) {
    const code = e?.message === 'UNAUTHORIZED' ? 401 : 403;
    return NextResponse.json({ message: 'دسترسی غیرمجاز' }, { status: code });
  }

  const { id } = await ctx.params;           // ⬅️ await the params

  const url = new URL(req.url);
  let methodOverride: string | null = url.searchParams.get('_method');
  if (!methodOverride && req.headers.get('content-type')?.includes('form')) {
    try { methodOverride = (await req.formData()).get('_method') as string | null; } catch {}
  }

  if (methodOverride === 'DELETE') {
    const usage = await prisma.userRole.count({ where: { roleId: id } });
    if (usage > 0) {
      const accepts = req.headers.get('accept') || '';
      if (accepts.includes('application/json')) {
        return NextResponse.json({ message: 'این نقش به کاربرانی تخصیص داده شده و قابل حذف نیست' }, { status: 409 });
      }
      return NextResponse.redirect(new URL('/admin/roles?error=in-use', req.url), { status: 303 });
    }

    await prisma.roleFormPermission.deleteMany({ where: { roleId: id } });
    await prisma.userRole.deleteMany({ where: { roleId: id } });
    await prisma.role.delete({ where: { id } });

    const accepts = req.headers.get('accept') || '';
    if (accepts.includes('application/json')) return NextResponse.json({ ok: true });
    return NextResponse.redirect(new URL('/admin/roles', req.url), { status: 303 });
  }

  return NextResponse.json({ message: 'Method Not Allowed' }, { status: 405 });
}
