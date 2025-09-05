import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

type Op = 'deltaPlus' | 'deltaMinus' | 'set';
type ApplyOn = 'final' | 'anyConfirm';

export async function applyKardexForEntry(entryId: string, actorUserId: string) {
  console.log('[kardex] apply start', { entryId });

  // Idempotency: skip if already applied
  const existing = await prisma.kardexTxn.findFirst({ where: { entryId } });
  if (existing) {
    console.log('[kardex] already_applied');
    return { applied: false, reason: 'already_applied' as const };
  }

  // Load entry + form + fields
  const entry = await prisma.formEntry.findUnique({
    where: { id: entryId },
    select: {
      id: true,
      payload: true,
      formId: true,
      form: { select: { id: true, code: true, fields: true } },
    },
  });
  if (!entry || !entry.form) {
    console.log('[kardex] entry_or_form_not_found');
    return { applied: false, reason: 'entry_or_form_not_found' as const };
  }

  const payload = entry.payload as Record<string, any>;
  console.log('[kardex] payload keys', Object.keys(payload));

  // Build mappings from kardexItem fields
  const mappings: Array<{
    itemCodeKey: string; // payload key holding KardexItem.code
    amountKey: string;   // payload key holding numeric amount
    op: Op;              // how to apply
    applyOn: ApplyOn;    // when to apply
  }> = [];

  const fields = (entry.form.fields as any[]) ?? [];
  for (const f of fields) {
    if (f?.type !== 'kardexItem') continue;

    const kcfg = (f.config?.kardex ?? {}) as Partial<{
      amountKey: string;
      op: Op;
      applyOn: ApplyOn;
    }>;

    if (!kcfg.amountKey) {
      console.log('[kardex] missing amountKey for', f.key);
      continue;
    }

    const op: Op = (kcfg.op ?? 'deltaPlus') as Op;
    const applyOn: ApplyOn = (kcfg.applyOn ?? 'final') as ApplyOn;

    mappings.push({
      itemCodeKey: f.key,
      amountKey: kcfg.amountKey,
      op,
      applyOn,
    });
  }

  if (mappings.length === 0) {
    console.log('[kardex] no_kardex_mappings');
    return { applied: false, reason: 'no_kardex_mappings' as const };
  }

  // Apply all in a single transaction
  const res = await prisma.$transaction(async (tx) => {
    let appliedCount = 0;

  for (const m of mappings) {
    const code = payload[m.itemCodeKey];
    const rawAmt = payload[m.amountKey];

    if (!code || rawAmt == null || rawAmt === '') { /* skip */ continue; }

    // 1) Coerce amount to a real number
    const amt = typeof rawAmt === 'number'
      ? rawAmt
      : Number(String(rawAmt).replace(',', '.'));
    if (!Number.isFinite(amt)) { /* skip */ continue; }

    const item = await tx.kardexItem.findUnique({ where: { code } });
    if (!item) { /* skip */ continue; }

    // 2) Coerce currentQty to a number (Decimal | string | number -> number)
    const curQty =
      typeof (item as any).currentQty === 'number'
        ? (item as any).currentQty
        : Number(String((item as any).currentQty ?? '0'));

    let delta = 0;
    let newQty = curQty;

    if (m.op === 'deltaPlus')      { delta = +amt;                newQty = curQty + delta; }
    else if (m.op === 'deltaMinus'){ delta = -Math.abs(amt);      newQty = curQty + delta; }
    else                           { delta = (+amt) - curQty;     newQty = +amt; }

    // 3) Create txn with Decimal values
    await tx.kardexTxn.create({
      data: {
        itemId: item.id,
        formId: entry.formId,
        entryId: entry.id,
        formCode: entry.form.code,
        op: m.op,
        amount: new Prisma.Decimal(amt),
        delta:  new Prisma.Decimal(delta),
        appliedById: actorUserId,
      },
    });

    // 4) Update KardexItem.currentQty as Decimal
    await tx.kardexItem.update({
      where: { id: item.id },
      data: { currentQty: new Prisma.Decimal(newQty) },
    });
        appliedCount++;
  }
  if (appliedCount > 0) {
    await tx.formEntry.update({
      where: { id: entry.id },
      data: { kardexApplied: true },
    });
  }

    return { applied: appliedCount > 0, appliedCount };
  });

  console.log('[kardex] done', res);
  return res;
}

/** true if any kardexItem field wants apply on any confirm (vs final) */
export function formWantsApplyOnAnyConfirm(fields: Array<{ type?: string; config?: any }>): boolean {
  for (const f of fields ?? []) {
    if (f?.type === 'kardexItem') {
      const applyOn = f.config?.kardex?.applyOn ?? 'final';
      if (applyOn === 'anyConfirm') return true;
    }
  }
  return false;
}
