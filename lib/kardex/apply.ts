import { prisma } from '@/lib/db';

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

      console.log('[kardex] read', {
        itemCodeKey: m.itemCodeKey,
        code,
        amountKey: m.amountKey,
        rawAmt,
      });

      if (!code || rawAmt == null || rawAmt === '') {
        console.log('[kardex] skip: missing code or amount');
        continue;
      }

      // Coerce to number safely
      const amt = typeof rawAmt === 'number'
        ? rawAmt
        : Number(String(rawAmt).replace(',', '.'));
      if (!Number.isFinite(amt)) {
        console.log('[kardex] skip: non-numeric amount', rawAmt);
        continue;
      }

      // Find Kardex item by code
      const item = await tx.kardexItem.findUnique({ where: { code } });
      if (!item) {
        console.log('[kardex] item not found', code);
        continue;
      }

      // Compute delta & new qty
      let delta = 0;
      let newQty = item.currentQty ?? 0;

      if (m.op === 'deltaPlus') {
        delta = +amt;
        newQty = newQty + delta;
      } else if (m.op === 'deltaMinus') {
        delta = -Math.abs(amt);
        newQty = newQty + delta;
      } else { // 'set'
        delta = (+amt) - newQty;
        newQty = +amt;
      }

      console.log('[kardex] apply', { code, op: m.op, amt, delta, from: item.currentQty, to: newQty });

      // Create txn row
      await tx.kardexTxn.create({
        data: {
          itemId: item.id,
          formId: entry.formId,
          entryId: entry.id,
          formCode: entry.form.code,
          op: m.op,
          amount: amt,
          delta: delta,
          appliedById: actorUserId,
        },
      });

      // Update item qty
      await tx.kardexItem.update({
        where: { id: item.id },
        data: { currentQty: newQty },
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
