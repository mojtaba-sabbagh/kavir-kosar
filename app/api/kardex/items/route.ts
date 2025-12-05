//api/kardex/items/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code  = (searchParams.get("code")  || "").trim();
  const codes = (searchParams.get("codes") || "").split(",").map(s => s.trim()).filter(Boolean);
  const q     = (searchParams.get("q")     || "").trim();
  const limit = Math.min(200, Number(searchParams.get("limit") || "20") || 20);

  const codeSet = new Set<string>();
  if (code) codeSet.add(code);
  for (const c of codes) codeSet.add(c);

  const where: any = {};
  if (codeSet.size) {
    where.code = { in: Array.from(codeSet) };
  } else if (q) {
    where.OR = [
      { code:   { contains: q } },
      { nameFa: { contains: q } },
    ];
  } else {
    // no filter -> return nothing to avoid scanning table
    return NextResponse.json({ ok: true, items: [] });
  }

  const items = await prisma.kardexItem.findMany({
    where,
    take: limit,
    orderBy: { code: "asc" },
    select: { code: true, nameFa: true, unit: true, extra: true },
  });

  return NextResponse.json({
    ok: true,
    items: items.map(it => ({
      code: it.code,
      nameFa: it.nameFa,
      unit: it.unit,
      // expose weight if you store it in extra.weight
      weight: typeof (it.extra as any)?.weight === "number" ? (it.extra as any).weight : null,
    })),
  });
}
