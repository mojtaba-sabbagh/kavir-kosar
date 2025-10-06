// app/(protected)/reports/daily-production/components/WasteSummarySection.tsx
import { prisma } from "@/lib/db";
import { headers, cookies } from "next/headers";
import { unstable_noStore as noStore } from "next/cache";

type Props = { date: string };

/* -------------------- tiny utils -------------------- */
function pick<T = any>(o: any, keys: string[], def?: any): T | undefined {
  for (const k of keys) {
    const val = k.split(".").reduce((acc: any, kk) => (acc ? acc[kk] : undefined), o);
    if (val !== undefined && val !== null && val !== "") return val as T;
  }
  return def;
}
function num(x: any): number { const n = Number(x); return Number.isFinite(n) ? n : 0; }
function codeFromAny(v: any): string {
  if (v == null) return "";
  if (typeof v === "object") {
    const raw = v.code ?? v.value ?? v.id ?? v.key ?? v.kardexCode ?? v.itemCode;
    return raw ? String(raw) : "";
  }
  return String(v);
}
function amountOf(obj: any): number { return num(pick(obj, ["amount", "qty", "مقدار", "تعداد"], 0)); }

/* -------------------- form code → id -------------------- */
async function getFormIdsByCodes(formCodes: string[]): Promise<string[]> {
  const forms = await prisma.form.findMany({ where: { code: { in: formCodes } }, select: { id: true } });
  return forms.map((f) => f.id);
}

/* ----------- fetch entries by payload.date (no createdAt) ----------- */
async function getFormEntries(date: string, formCodes: string[]) {
  const formIds = await getFormIdsByCodes(formCodes);
  if (formIds.length === 0) return [];
  return prisma.formEntry.findMany({
    where: {
      formId: { in: formIds },
      OR: [
        { payload: { path: ["date"], equals: date } },
        { payload: { path: ["payloadDate"], equals: date } },
        { payload: { path: ["tarikh"], equals: date } },
        { payload: { path: ["payload", "date"], equals: date } },
      ],
    },
    select: { id: true, payload: true, formId: true },
    orderBy: { id: "asc" },
  });
}

/* -------------------- FixedInformation lookup -------------------- */
async function fetchFixedTitles(codes: string[]): Promise<Map<string, string>> {
  noStore();
  const map = new Map<string, string>();
  const uniq = Array.from(new Set(codes.filter(Boolean).map(String))).slice(0, 200);
  if (uniq.length === 0) return map;

  const h = await headers();
  const ck = await cookies();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const base = process.env.NEXT_PUBLIC_APP_URL || (host ? `${proto}://${host}` : "");
  const cookieHeader = ck.getAll().map((c) => `${c.name}=${c.value}`).join("; ");

  const params = new URLSearchParams();
  params.set("codes", uniq.join(","));
  const url = `${base}/api/lookups/fixed?${params.toString()}`;

  try {
    const r = await fetch(url, {
      headers: { cookie: cookieHeader, accept: "application/json" },
      cache: "no-store",
      next: { revalidate: 0 },
    });
    const items: any[] = r.ok ? (await r.json().catch(() => null))?.items ?? [] : [];
    for (const it of items) {
      const c = String(it?.code ?? "");
      // Prefer the exact `title` field, then common fallbacks.
      const t = it?.title ?? it?.titleFa ?? it?.nameFa ?? it?.name ?? it?.label ?? "";
      if (c) map.set(c, t ? String(t) : c);
    }
    // Fallback per-code for any misses
    const missing = uniq.filter((c) => !map.has(c));
    if (missing.length) {
      await Promise.allSettled(
        missing.map(async (c) => {
          const p = new URLSearchParams(); p.set("codes", c);
          const u = `${base}/api/lookups/fixed?${p.toString()}`;
          const rr = await fetch(u, { headers: { cookie: cookieHeader, accept: "application/json" }, cache: "no-store", next: { revalidate: 0 } });
          const jj = rr.ok ? (await rr.json().catch(() => null)) : null;
          const it1 = Array.isArray(jj?.items) ? jj.items.find((x: any) => String(x?.code) === c) : null;
          const t1 = it1?.title ?? it1?.titleFa ?? it1?.nameFa ?? it1?.name ?? it1?.label ?? "";
          map.set(c, t1 ? String(t1) : c);
        })
      );
    }
  } catch {
    for (const c of uniq) map.set(c, c);
  }
  return map;
}

/* -------------------- rules (wasteCode + rawSelector) -------------------- */
const RULES = [
  { wasteCode: "5203280100", rawSelector: (c: string) => c === "1101000001" }, // درصد ضایعات برگه
  { wasteCode: "5203290100", rawSelector: (c: string) => c === "1101000001" }, // درصد ضایعات خمیر
  { wasteCode: "5103420000", rawSelector: (c: string) => c === "1101000001" }, // درصد ضایعات زیرماردن
  { wasteCode: "5102030100", rawSelector: (c: string) => c.startsWith("22") }, // درصد ضایعات سلفون
  { wasteCode: "5101020100", rawSelector: (c: string) => c.startsWith("21") }, // درصد ضایعات کارتن
] as const;

export default async function WasteSummarySection({ date }: Props) {
  // 1) fetch waste + raw entries by payload date
  const wasteEntries = await getFormEntries(date, ["1020508", "1020400"]);
  const rawEntries   = await getFormEntries(date, ["1031100"]);

  // 2) aggregate by code
  const wasteByCode = new Map<string, number>();
  for (const e of wasteEntries) {
    const v = (e.payload ?? {}) as any;
    const code =
      codeFromAny(v?.waste) ||
      pick<string>(v, ["code", "kardexCode", "itemCode", "کد", "کد_کاردکس"]) ||
      "";
    const amt = amountOf(v);
    if (!code || !amt) continue;
    wasteByCode.set(code, (wasteByCode.get(code) ?? 0) + amt);
  }

  const rawByCode = new Map<string, number>();
  for (const e of rawEntries) {
    const v = (e.payload ?? {}) as any;
    const code =
      codeFromAny(v?.raw_material) ||
      pick<string>(v, ["rawMaterial", "raw_material", "code", "kardexCode", "itemCode"]) ||
      "";
    const amt = amountOf(v);
    if (!code || !amt) continue;
    rawByCode.set(code, (rawByCode.get(code) ?? 0) + amt);
  }

  // 3) fetch labels for waste codes from FixedInformation (field: title)
  const labelMap = await fetchFixedTitles(RULES.map((r) => r.wasteCode));

  // 4) compute rows
  const rows = RULES.map((r) => {
    const labelFromFI = labelMap.get(r.wasteCode); // ← title from FixedInformation
    const labelFa = labelFromFI || r.wasteCode;    // fallback to code if not found

    const wasteSum = wasteByCode.get(r.wasteCode) ?? 0;

    let rawSum = 0;
    for (const [c, a] of rawByCode.entries()) if (r.rawSelector(c)) rawSum += a;

    const pct = rawSum > 0 ? (wasteSum / rawSum) * 100 : 0;

    return { labelFa, wasteSum, rawSum, pct };
  });

  const grandWaste = rows.reduce((s, r) => s + r.wasteSum, 0);
  const grandRaw   = rows.reduce((s, r) => s + r.rawSum, 0);

  // 5) render
  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-4 py-3 font-semibold text-gray-900">
        خلاصه درصد ضایعات (نسبت به مصرف مواد اولیه روز)
      </div>
      <div className="overflow-x-auto p-4">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-white">
            <tr>
              <th className="px-3 py-2 text-right text-sm font-medium text-gray-900">شرح</th>
              <th className="px-3 py-2 text-left  text-sm font-medium text-gray-900">جمع ضایعات</th>
              <th className="px-3 py-2 text-left  text-sm font-medium text-gray-900">مصرف مواد پایه</th>
              <th className="px-3 py-2 text-left  text-sm font-medium text-gray-900">% ضایعات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="px-3 py-2">{r.labelFa}</td>
                <td className="px-3 py-2 text-left">{r.wasteSum.toLocaleString("fa-IR")}</td>
                <td className="px-3 py-2 text-left">{r.rawSum.toLocaleString("fa-IR")}</td>
                <td className="px-3 py-2 text-left font-semibold">
                  {grandRaw > 0 && r.rawSum > 0 ? r.pct.toFixed(2) : "-"}{grandRaw > 0 && r.rawSum > 0 ? "٪" : ""}
                </td>
              </tr>
            ))}
            <tr>
              <td className="px-3 py-2 font-semibold">جمع روز</td>
              <td className="px-3 py-2 text-left  font-semibold">{grandWaste.toLocaleString("fa-IR")}</td>
              <td className="px-3 py-2 text-left  font-semibold">{grandRaw.toLocaleString("fa-IR")}</td>
              <td className="px-3 py-2 text-left  font-semibold">
                {grandRaw > 0 ? ((grandWaste / grandRaw) * 100).toFixed(2) : "-"}{grandRaw > 0 ? "٪" : ""}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
