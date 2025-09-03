// app/api/forms/submit/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { buildZodSchema } from '@/lib/forms/schema-builder';
import { generateConfirmationTasks } from '@/lib/workflow';
import { syncEntryRelations } from '@/lib/forms/relations';

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

  // Integrity checks for entryRef / entryRefMulti
const refFields = form.fields.filter(f => f.type === 'entryRef' || f.type === 'entryRefMulti');
if (refFields.length) {
  // Collect all referenced ids
  const allIds: string[] = [];
  for (const f of refFields) {
    const v = (parsed.data as any)[f.key];
    if (!v) continue;
    if (f.type === 'entryRef' && typeof v === 'string') allIds.push(v);
    if (f.type === 'entryRefMulti' && Array.isArray(v)) allIds.push(...v);
  }

  if (allIds.length) {
    // Check they exist
    const targets = await prisma.formEntry.findMany({
      where: { id: { in: allIds } },
      select: { id: true, formId: true },
    });
    const foundIds = new Set(targets.map(t => t.id));
    const missing = allIds.filter(id => !foundIds.has(id));
    if (missing.length) {
      return NextResponse.json({ message: 'شناسه ارجاع نامعتبر است' }, { status: 422 });
    }

    // Check the current user has canRead on those target forms
    const targetFormIds = Array.from(new Set(targets.map(t => t.formId)));
    const canReadCount = await prisma.roleFormPermission.count({
      where: {
        formId: { in: targetFormIds },
        canRead: true,
        role: { users: { some: { userId: user.id } } },
      },
    });
    if (canReadCount === 0 && targetFormIds.length > 0) {
      return NextResponse.json({ message: 'مجوز مشاهده فرم‌های ارجاعی را ندارید' }, { status: 403 });
    }
  }
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
  // Sync EntryRelation rows from payload
  await syncEntryRelations({ entryId: entry.id, fields: form.fields, payload: parsed.data });
  
  await generateConfirmationTasks(entry.id);

  return NextResponse.json({ ok: true, entryId: entry.id });
}
