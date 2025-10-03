import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";

function toPlainObj(v: unknown): Record<string, any> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, any>) : {};
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // read body
  const body = await req.json().catch(() => ({}));
  const incoming = toPlainObj((body as any).extra); // only keep object shape

  // current record
  const current = await prisma.kardexItem.findUnique({
    where: { id },
    select: { extra: true },
  });

  const base = toPlainObj(current?.extra);          // normalize JSON to object

  // now both are objects, safe to spread
  const merged: Record<string, any> = { ...base, ...incoming };

  // if weight is explicitly null -> remove key
  if (Object.prototype.hasOwnProperty.call(incoming, "weight") && incoming.weight === null) {
    delete merged.weight;
  }

  // optional: coerce weight to number if it’s a numeric string
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
