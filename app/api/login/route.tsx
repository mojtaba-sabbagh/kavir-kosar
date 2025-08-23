import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { createSession } from '@/lib/auth';
import { z } from 'zod';


const bodySchema = z.object({ email: z.string().email(), password: z.string().min(6) });


export async function POST(req: Request) {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ message: 'ورودی نامعتبر' }, { status: 422 });

    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) return NextResponse.json({ message: 'ایمیل یا رمز عبور نادرست است' }, { status: 401 });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return NextResponse.json({ message: 'ایمیل یا رمز عبور نادرست است' }, { status: 401 });


    await createSession({ id: user.id, email: user.email, name: user.name });
    return NextResponse.json({ ok: true });
}