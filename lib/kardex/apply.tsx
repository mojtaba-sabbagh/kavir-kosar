import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

export async function applyKardexForEntry(entryId: string, actorUserId: string) {
  // run everything inside a transaction for atomicity
  return prisma.$transaction(async (tx) => {
    // lock entry & related form
    const entry = await tx.formEntry.findUnique({
      where: { id: entryId },
      include: { form: true },
    });
    if (!entry) throw new Error('ENTRY_NOT_FOUND');
    if (entry.kardexApplied) return { ok: true, skipped: 'already_applied' }; // idempotent

    // find the mapping rule for this form
    const rule = await tx.formKardexRule.findUnique({ where: { formId: entry.formId } });
    if (!rule) return { ok: true, skipped: 'no_rule' }; // not all forms affect Kardex

    // read payload keys
    const payload: any = entry.payload || {};
    const rawCode = (payload[rule.codeKey] ?? '').toString().trim();
    const rawQty  = payload[rule.qtyKey];

    if (!rawCode) throw new Error('KARDEX_CODE_MISSING');
    const qty = typeof rawQty === 'number' ? rawQty : Number(rawQty);
    if (!isFinite(qty)) throw new Error('KARDEX_QTY_INVALID');

    // fetch or create item
    let item = await tx.kardexItem.findUnique({ where: { code: rawCode } });
    if (!item) {
      if (!rule.createIfMissing) throw new Error('KARDEX_ITEM_NOT_FOUND');
      item = await tx.kardexItem.create({
        data: {
          code: rawCode,
          nameFa: (rule.nameKey ? (payload[rule.nameKey] ?? rawCode) : rawCode).toString(),
          currentQty: new Prisma.Decimal(0),
        },
      });
    }

    // compute next qty
    const prev = item.currentQty ? Number(item.currentQty) : 0;
    let next: number;
    let delta: number;

    if (rule.mode === 'set') {
      next = qty;
      delta = qty - prev;
    } else {
      // delta
      next = prev + qty;
      delta = qty;
    }

    if (!rule.allowNegative && next < 0) {
      throw new Error('KARDEX_NEGATIVE_NOT_ALLOWED');
    }

    // write movement (unique per entryId guarantees idempotency)
    await tx.kardexTxn.create({
      data: {
        itemId: item.id,
        entryId: entry.id,
        formId: entry.formId,
        formCode: entry.formCode ?? entry.form?.code ?? '',
        userId: actorUserId,
        qtyDelta: new Prisma.Decimal(delta),
        prevQty: new Prisma.Decimal(prev),
        newQty: new Prisma.Decimal(next),
      },
    });

    // update stock
    await tx.kardexItem.update({
      where: { id: item.id },
      data: { currentQty: new Prisma.Decimal(next) },
    });

    // mark applied
    await tx.formEntry.update({
      where: { id: entry.id },
      data: { kardexApplied: true },
    });

    return { ok: true, applied: true, itemCode: item.code, prev, next, delta };
  });
}
