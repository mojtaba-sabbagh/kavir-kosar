// app/api/admin/kardex/[id]/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

// ---------- helpers ----------
function toPlainObj(v: unknown): Record<string, any> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, any>) : {};
}

// Accept number, "123", null, or "" (=> undefined -> don't update)
const numberish = z.preprocess((v) => {
  if (v === "") return undefined;
  if (v === null) return null;
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n as number) ? n : undefined;
}, z.number().nullable().optional());

// ---------- PATCH: extra-only (legacy behavior) ----------
async function updateExtraOnly(req: NextRequest, id: string) {
  const raw = await req.json().catch(() => ({} as any));
  const incoming = toPlainObj(Object.prototype.hasOwnProperty.call(raw, "extra") ? raw.extra : raw);

  const current = await prisma.kardexItem.findUnique({
    where: { id },
    select: { extra: true },
  });
  if (!current) return NextResponse.json({ ok: false, message: "Not found" }, { status: 404 });

  const base = toPlainObj(current.extra);
  const merged: Record<string, any> = { ...base, ...incoming };

  // Special: remove weight if explicitly null
  if (Object.prototype.hasOwnProperty.call(incoming, "weight") && incoming.weight === null) {
    delete merged.weight;
  }
  // Coerce weight string -> number
  if (typeof merged.weight === "string") {
    const n = Number(merged.weight);
    if (Number.isFinite(n)) merged.weight = n;
  }

  await prisma.kardexItem.update({ where: { id }, data: { extra: merged } });
  return NextResponse.json({ ok: true, extra: merged });
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return updateExtraOnly(req, id);
}

// ---------- PUT: full update (top-level fields + optional extra merge) ----------
export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const body = await req.json().catch(() => ({} as any));

  const schema = z.object({
    code: z.string().optional(),
    nameFa: z.string().optional(),
    storage: z.string().nullable().optional(),
    currentQty: numberish,
    openingQty: numberish,
    orderPoint: numberish,
    // Allow partial patch; null clears entire extra; null values inside object remove those keys
    extra: z.record(z.string(), z.unknown()).nullable().optional()
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "ورودی نامعتبر", issues: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;

  // Build update data using presence (undefined vs null) — don't drop 0/null
  const data: Record<string, any> = {};
  if ("code" in d) data.code = d.code;
  if ("nameFa" in d) data.nameFa = d.nameFa;
  if ("storage" in d) data.storage = d.storage;
  if ("currentQty" in d) data.currentQty = d.currentQty;
  if ("openingQty" in d) data.openingQty = d.openingQty;
  if ("orderPoint" in d) data.orderPoint = d.orderPoint;

  if ("extra" in d) {
    if (d.extra === null) {
      data.extra = null; // explicit clear
    } else if (d.extra && typeof d.extra === "object") {
      const existing = await prisma.kardexItem.findUnique({ where: { id }, select: { extra: true } });
      const base = toPlainObj(existing?.extra);
      const patch = toPlainObj(d.extra);
      const merged = { ...base, ...patch };

      // If a key in patch is explicitly null, remove it from merged (delete semantics)
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) delete (merged as any)[k];
      }

      // Optional: coerce known numeric subfields
      if ("weight" in merged && typeof (merged as any).weight === "string") {
        const n = Number((merged as any).weight);
        if (Number.isFinite(n)) (merged as any).weight = n;
      }

      data.extra = merged;
    }
  }

  const updated = await prisma.kardexItem.update({ where: { id }, data });
  return NextResponse.json({ ok: true, item: updated });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { Allow: "PUT, PATCH, OPTIONS" } });
}
