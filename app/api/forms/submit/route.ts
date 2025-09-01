// app/api/forms/submit/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { buildZodSchema } from '@/lib/forms/schema-builder';
import { generateConfirmationTasks } from '@/lib/workflow';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ message: 'ابتدا وارد سامانه شوید' }, { status: 401 });

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  if (!code) return NextResponse.json({ message: 'کد فرم ارسال نشده است' }, { status: 400 });

  const form = await prisma.form.findUnique({
    where: { code },
    include: { fields: true },
  });
  if (!form || !form.isActive) {
    return NextResponse.json({ message: 'فرم یافت نشد' }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ message: 'ورودی نامعتبر' }, { status: 422 });
  }

  const schema = buildZodSchema(form.fields);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: 'ورودی نامعتبر' }, { status: 422 });
  }

  const entry = await prisma.formEntry.create({
    data: {
      formId: form.id,
      createdBy: user.id,
      payload: parsed.data,
      formVersion: form.version,
      status: 'submitted',
    },
  });

  await generateConfirmationTasks(entry.id);

  return NextResponse.json({ ok: true, entryId: entry.id });
}
