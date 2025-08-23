// app/api/auth/login/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { createSession } from '@/lib/auth';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Remove directionality/zero-width chars that can leak from RTL UIs
const STRIP_BIDI = /[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;   // LRM, RLM, LRE/RLE/PDF/LRI/RLI/FSI/PDI
const STRIP_ZW   = /[\u200b\u200c\u200d\u2060]/g;                 // ZWSP, ZWNJ, ZWJ, WJ

const bodySchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

function sanitizeEmail(e: string) {
  return e.replace(STRIP_BIDI, '').replace(STRIP_ZW, '').trim().toLowerCase();
}
function sanitizePassword(p: string) {
  // do NOT trim (valid passwords may end with spaces); just remove hidden zero-widths
  return p.replace(STRIP_BIDI, '').replace(STRIP_ZW, '');
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ message: 'ورودی نامعتبر' }, { status: 422 });
    }

    const email = sanitizeEmail(parsed.data.email);
    const password = sanitizePassword(parsed.data.password);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      return NextResponse.json({ message: 'ایمیل یا رمز عبور نادرست است' }, { status: 401 });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ message: 'ایمیل یا رمز عبور نادرست است' }, { status: 401 });
    }

    await createSession({ id: user.id, email: user.email, name: user.name ?? null });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('login error:', e);
    return NextResponse.json({ message: 'خطای سرور' }, { status: 500 });
  }
}
