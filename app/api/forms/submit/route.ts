// app/api/forms/submit/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { buildZodSchema } from '@/lib/forms/schema-builder';
import { generateConfirmationTasks } from '@/lib/workflow';
import { syncEntryRelations } from '@/lib/forms/relations';
import type { Prisma } from '@prisma/client';
import { Prisma as P } from '@prisma/client'; // for Decimal

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function asStr(v: any) {
  if (v == null) return '';
  return typeof v === 'string' ? v.trim() : String(v).trim();
}
function D(v: any) {
  try { return new P.Decimal(v ?? 0); } catch { return new P.Decimal(0); }
}

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

  const payload: any = parsed.data;

  // ===== KARDEX constraint (per-field config) ==============================
  // For each kardexItem field: config.kardex = { op: 'deltaMinus'|'...', amountKey: 'amount' }
  // If op === 'deltaMinus': ensure payload[amountKey] <= KardexItem.currentQty
  const kardexFields = form.fields.filter(f => f.type === 'kardexItem');

  for (const f of kardexFields) {
    const cfg = (f.config ?? {}) as any;
    const kcfg = cfg.kardex ?? {};
    const op = asStr(kcfg.op);
    const amountKey = asStr(kcfg.amountKey);

    if (op !== 'deltaMinus' || !amountKey) continue; // only enforce for deltaMinus

    const selected = payload[f.key]; // value of the kardex field (id or code)
    const amountReq = D(payload[amountKey]);

    // Only check when a positive amount is requested
    if (!selected || !amountReq.gt(0)) continue;

    // Try to resolve item by code OR id (supports either payload style)
    const selStr = asStr(selected);
    const item = await prisma.kardexItem.findFirst({
      where: { OR: [{ code: selStr }, { id: selStr }] },
      select: { code: true, nameFa: true, currentQty: true },
    });

    if (!item) {
      return NextResponse.json(
        { message: 'آیتم کاردکس یافت نشد', error: 'KARDEX_NOT_FOUND', field: f.key, value: selStr },
        { status: 422 }
      );
    }

    const available = D(item.currentQty);
    if (amountReq.gt(available)) {
      return NextResponse.json(
        {
          message: 'موجودی کافی نیست',
          error: 'INSUFFICIENT_STOCK',
          field: f.key,
          code: item.code,
          nameFa: item.nameFa,
          amountKey,
          requested: amountReq.toFixed(3),
          available: available.toFixed(3),
        },
        { status: 422 }
      );
    }
  }
  // ========================================================================

  // Integrity checks for entryRef / entryRefMulti
  const refFields = form.fields.filter(f => f.type === 'entryRef' || f.type === 'entryRefMulti');
  if (refFields.length) {
    const allIds: string[] = [];
    for (const f of refFields) {
      const v = payload[f.key];
      if (!v) continue;
      if (f.type === 'entryRef' && typeof v === 'string') allIds.push(v);
      if (f.type === 'entryRefMulti' && Array.isArray(v)) allIds.push(...v);
    }

    if (allIds.length) {
      const targets = await prisma.formEntry.findMany({
        where: { id: { in: allIds } },
        select: { id: true, formId: true },
      });
      const foundIds = new Set(targets.map(t => t.id));
      const missing = allIds.filter(id => !foundIds.has(id));
      if (missing.length) {
        return NextResponse.json({ message: 'شناسه ارجاع نامعتبر است' }, { status: 422 });
      }

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

  const cleanPayload = JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue;
  const entry = await prisma.formEntry.create({
    data: {
      formId: form.id,
      createdBy: user.id,
      payload: cleanPayload,
      formVersion: form.version,
      status: 'submitted',
    },
  });

  await syncEntryRelations({ entryId: entry.id, fields: form.fields, payload });
  await generateConfirmationTasks(entry.id);

  return NextResponse.json({ ok: true, entryId: entry.id });
}
