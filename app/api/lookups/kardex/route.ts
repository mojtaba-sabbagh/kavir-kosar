// app/api/lookups/kardex/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const codesParam = url.searchParams.get("codes") || "";
  const codes = [...new Set(codesParam.split(",").map(s => s.trim()).filter(Boolean))];
  if (!codes.length) return NextResponse.json({ items: [] }, { status: 200 });

  const items = await prisma.kardexItem.findMany({
    where: { code: { in: codes } },
    select: { code: true, nameFa: true, extra: true },
  });

  return NextResponse.json({
    items: items.map(i => ({
      code: i.code,
      nameFa: i.nameFa,
      weight: (i.extra as any)?.weight ?? null,
    })),
  });
}
