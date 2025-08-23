// app/api/admin/users/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/rbac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Optional: sanitize email for RTL UIs
const STRIP_BIDI = /[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;
const STRIP_ZW   = /[\u200b\u200c\u200d\u2060]/g;
const sanitizeEmail = (s: string) =>
  s.replace(STRIP_BIDI, '').replace(STRIP_ZW, '').trim().toLowerCase();

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).optional().nullable(),
  password: z.string().min(6, 'طول رمز عبور حداقل باید ۶ کاراکتر باشد'),
  passwordConfirm: z.string().min(1, 'تأیید رمز عبور الزامی است'),
  roleIds: z.array(z.string().min(1)).default([]),
}).refine((d) => d.password === d.passwordConfirm, {
  message: 'رمز عبور و تأیید آن یکسان نیست',
  path: ['passwordConfirm'],
});

export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch (e: any) {
    const code = e?.message === 'UNAUTHORIZED' ? 401 : 403;
    return NextResponse.json({ message: 'دسترسی غیرمجاز' }, { status: code });
  }

  const body = await req.json();
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    // Return first error message for simplicity
    const issue = parsed.error.issues[0];
    return NextResponse.json({ message: issue?.message || 'ورودی نامعتبر' }, { status: 422 });
  }

  const email = sanitizeEmail(parsed.data.email);
  const name = parsed.data.name ?? null;
  const { password, roleIds } = parsed.data;

  // Unique email
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    return NextResponse.json({ message: 'این ایمیل قبلاً ثبت شده است' }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // Validate roles -> keep only valid ids
  const roles = await prisma.role.findMany({ where: { id: { in: roleIds } } });
  const validRoleIds = roles.map((r) => r.id);

  // Create user + roles atomically
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: { email, name, passwordHash },
    });
    if (validRoleIds.length) {
      await tx.userRole.createMany({
        data: validRoleIds.map((roleId) => ({ userId: created.id, roleId })),
        skipDuplicates: true,
      });
    }
    return created;
  });

  return NextResponse.json({ user });
}
