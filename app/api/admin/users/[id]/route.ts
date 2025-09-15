// app/api/admin/users/[id]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/rbac';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STRIP_BIDI = /[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;
const STRIP_ZW   = /[\u200b\u200c\u200d\u2060]/g;
const sanitizeEmail = (s: string) =>
  s.replace(STRIP_BIDI,'').replace(STRIP_ZW,'').trim().toLowerCase();

const updateSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).nullable().optional(),
  password: z.string().min(6).optional(),        // if provided, will reset password
  roleIds: z.array(z.string().min(1)).optional() // set full list of roles
});

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (e: any) {
    const code = e?.message === 'UNAUTHORIZED' ? 401 : 403;
    return NextResponse.json({ message: 'دسترسی غیرمجاز' }, { status: code });
  }
  const params = await ctx.params;
  const userId = params.id;
  const json = await req.json();
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ message: 'ورودی نامعتبر' }, { status: 422 });
  }

  const data = parsed.data;

  // Validate target user exists
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) return NextResponse.json({ message: 'کاربر یافت نشد' }, { status: 404 });

  // Email change: ensure unique
  let email: string | undefined;
  if (data.email) {
    email = sanitizeEmail(data.email);
    if (email !== existing.email) {
      const dup = await prisma.user.findUnique({ where: { email } });
      if (dup) return NextResponse.json({ message: 'این ایمیل قبلاً ثبت شده است' }, { status: 409 });
    }
  }

  // Prepare user update
  const updateUser: any = {};
  if (typeof email !== 'undefined') updateUser.email = email;
  if ('name' in data) updateUser.name = data.name ?? null;
  if (data.password) {
    updateUser.passwordHash = await bcrypt.hash(data.password, 10);
  }

  // Roles update (if provided): replace all links
  if (data.roleIds) {
    const roles = await prisma.role.findMany({ where: { id: { in: data.roleIds } } });
    const validRoleIds = roles.map(r => r.id);

    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: updateUser }),
      prisma.userRole.deleteMany({ where: { userId } }),
      ...(validRoleIds.length
        ? [prisma.userRole.createMany({
            data: validRoleIds.map(roleId => ({ userId, roleId })),
            skipDuplicates: true
          })]
        : []),
    ]);
  } else {
    // Only user fields update
    await prisma.user.update({ where: { id: userId }, data: updateUser });
  }

  return NextResponse.json({ ok: true });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  // keep supporting form-based DELETE with _method override
  try {
    await requireAdmin();
  } catch (e: any) {
    const code = e?.message === 'UNAUTHORIZED' ? 401 : 403;
    return NextResponse.json({ message: 'دسترسی غیرمجاز' }, { status: code });
  }
  const params = await ctx.params;
  const url = new URL(req.url);
  let methodOverride: string | null = url.searchParams.get('_method');
  if (!methodOverride && req.headers.get('content-type')?.includes('form')) {
    try { methodOverride = (await req.formData()).get('_method') as string | null; } catch {}
  }

  if (methodOverride === 'DELETE') {
    await prisma.userRole.deleteMany({ where: { userId: params.id } });
    await prisma.user.delete({ where: { id: params.id } });

    const accepts = req.headers.get('accept') || '';
    if (accepts.includes('application/json')) {
      return NextResponse.json({ ok: true });
    }
    return NextResponse.redirect(new URL('/admin/users', req.url), { status: 303 });
  }

  return NextResponse.json({ message: 'Method Not Allowed' }, { status: 405 });
}
