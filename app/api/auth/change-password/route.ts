// app/api/auth/change-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

function validatePassword(pwd: string): string[] {
  const errs: string[] = [];
  if (!pwd || pwd.length < 8) errs.push('حداقل ۸ کاراکتر لازم است.');
  if (!/[A-Z]/.test(pwd)) errs.push('حداقل یک حرف بزرگ لاتین لازم است.');
  if (!/[a-z]/.test(pwd)) errs.push('حداقل یک حرف کوچک لاتین لازم است.');
  if (!/\d/.test(pwd)) errs.push('حداقل یک عدد لازم است.');
  // Optional: if you want symbols too -> if (!/[^\w\s]/.test(pwd)) errs.push('حداقل یک نماد لازم است.');
  return errs;
}

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getSession();
    if (!sessionUser?.id) {
      return NextResponse.json({ message: 'نیاز به ورود دارید.' }, { status: 401 });
    }

    const { currentPassword, newPassword, confirmNewPassword } = await req.json();

    if (!newPassword || !confirmNewPassword) {
      return NextResponse.json({ message: 'رمز عبور جدید و تکرار آن الزامی است.' }, { status: 400 });
    }
    if (newPassword !== confirmNewPassword) {
      return NextResponse.json({ message: 'رمز عبور جدید و تکرار آن یکسان نیستند.' }, { status: 400 });
    }

    const strengthErrors = validatePassword(newPassword);
    if (strengthErrors.length) {
      return NextResponse.json(
        { message: 'رمز عبور جدید ضعیف است.', details: strengthErrors },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { passwordHash: true },
    });

    // If account already has a password, verify current one
    if (user?.passwordHash) {
      if (!currentPassword) {
        return NextResponse.json({ message: 'رمز عبور فعلی را وارد کنید.' }, { status: 400 });
      }
      const ok = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!ok) {
        return NextResponse.json({ message: 'رمز عبور فعلی نادرست است.' }, { status: 400 });
      }
    } else {
      // If the user had no password (e.g., created via invite/SSO), we let them set one without current
      // Optionally enforce currentPassword === '' here.
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: sessionUser.id },
      data: { passwordHash: newHash },
    });

    // (Optional) If you keep server-side sessions, you may want to invalidate other sessions here.

    return NextResponse.json({ ok: true, message: 'رمز عبور با موفقیت تغییر کرد.' });
  } catch (err) {
    console.error('change-password error:', err);
    return NextResponse.json({ message: 'خطای غیرمنتظره رخ داد.' }, { status: 500 });
  }
}
