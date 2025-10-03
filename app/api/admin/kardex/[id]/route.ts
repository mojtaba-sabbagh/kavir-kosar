// app/api/admin/kardex/[id]/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic"; // optional, but helps during edits

function toPlainObj(v: unknown): Record<string, any> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, any>) : {};
}

async function updateExtraById(req: NextRequest, id: string) {
  // Body can be { extra: {...} } or plain object -> treat as extra
  const raw = await req.json().catch(() => ({} as any));
  const incoming = toPlainObj(Object.prototype.hasOwnProperty.call(raw, "extra") ? raw.extra : raw);

  const current = await prisma.kardexItem.findUnique({
    where: { id },
    select: { extra: true },
  });
  if (!current) return NextResponse.json({ ok: false, message: "Not found" }, { status: 404 });

  const base = toPlainObj(current.extra);
  const merged: Record<string, any> = { ...base, ...incoming };

  // handle weight delete / coerce
  if (Object.prototype.hasOwnProperty.call(incoming, "weight") && incoming.weight === null) {
    delete merged.weight;
  }
  if (typeof merged.weight === "string") {
    const n = Number(merged.weight);
    if (Number.isFinite(n)) merged.weight = n;
  }

  await prisma.kardexItem.update({
    where: { id },
    data: { extra: merged },
  });

  return NextResponse.json({ ok: true, extra: merged });
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return updateExtraById(req, id);
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return updateExtraById(req, id);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { Allow: "PUT, PATCH, OPTIONS" } });
}
