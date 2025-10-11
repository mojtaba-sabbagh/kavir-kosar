// app/(protected)/reports/daily-production/components/RawMaterialsSection.tsx
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type ProductKey = "1" | "2";

type Props = {
  date: string;
  hours?: number;
  shifts?: (1 | 2 | 3)[];
  onlyConfirmed?: boolean;
  product: ProductKey; // "1" chips | "2" popcorn
};

/* ---------------- utilities ---------------- */
function faToEnDigits(s: any): string {
  const str = String(s ?? "");
  const map: Record<string, string> = {
    "۰":"0","۱":"1","۲":"2","۳":"3","۴":"4","۵":"5","۶":"6","۷":"7","۸":"8","۹":"9",
    "٠":"0","١":"1","٢":"2","٣":"3","٤":"4","٥":"5","٦":"6","٧":"7","٨":"8","٩":"9",
  };
  return str.replace(/[0-9۰-۹٠-٩]/g, (ch) => map[ch] ?? ch);
}
function cleanCode(input: any): string | undefined {
  if (input == null) return undefined;
  const s = faToEnDigits(String(input));
  const digits = s.replace(/[^\d]/g, "");
  return digits || undefined;
}
function parseShift(value: any): 1 | 2 | 3 | undefined {
  const n = Number(value);
  return n === 1 || n === 2 || n === 3 ? (n as 1 | 2 | 3) : undefined;
}
function fmtEn(n: number, frac = 3) {
  return n.toLocaleString("en-US", { maximumFractionDigits: frac, minimumFractionDigits: 0 });
}

/* ------------ your groups (kept) ------------ */
const RAW_MATERIAL_GROUPS_BY_PRODUCT: Record<
  ProductKey,
  Array<{ key: string; labelFa: string; prefixes?: string[]; patterns?: string[] }>
> = {
  "1": [
    { key: "corn",   labelFa: "ذرت",           prefixes: ["110"] },
    { key: "oil",    labelFa: "روغن",          prefixes: ["1204"] },
    { key: "lime",   labelFa: "آهک",           prefixes: ["1522"] },
    { key: "spice",  labelFa: "ادویه",         patterns: ["13***1****", "32***1****"] },
    { key: "selfon", labelFa: "سلفون",         patterns: ["22***1****"] },
    { key: "box",    labelFa: "کارتن",         patterns: ["21***1****"] },
  ],
  "2": [
    { key: "corn",   labelFa: "ذرت پاپکورن",   prefixes: ["112"] },
    { key: "oil",    labelFa: "روغن",          prefixes: ["1204"] },
    { key: "lime",   labelFa: "آهک",           prefixes: ["1522"] },
    { key: "spice",  labelFa: "ادویه",         patterns: ["13***2****", "32***2****"] },
    { key: "selfon", labelFa: "سلفون",         patterns: ["22***2****"] },
    { key: "box",    labelFa: "کارتن",         patterns: ["21***2****"] },
  ],
};

type GroupKey = (typeof RAW_MATERIAL_GROUPS_BY_PRODUCT)["1"][number]["key"];
type ShiftNum = 1 | 2 | 3;

type Totals = Record<GroupKey, { shifts: Record<ShiftNum, number>; total: number }>;
function initTotals(groups: typeof RAW_MATERIAL_GROUPS_BY_PRODUCT["1"]): Totals {
  const base: any = {};
  for (const g of groups) base[g.key] = { shifts: { 1: 0, 2: 0, 3: 0 }, total: 0 };
  return base as Totals;
}

/* ---------------- pattern helpers ---------------- */
function patternToRegex(p: string): RegExp {
  // "13***1****" => ^13\d{3}1\d{4}$
  const esc = p.replace(/([.*+?^${}()|\[\]\\])/g, "\\$1");
  const rx = "^" + esc.replace(/\*/g, "\\d") + "$";
  return new RegExp(rx);
}
function matchesAnyPattern(code: string, patterns: string[] | undefined): boolean {
  if (!patterns?.length) return false;
  const c = cleanCode(code) ?? "";
  return patterns.some((p) => patternToRegex(p).test(c));
}
function startsWithAnyPrefix(code: string, prefixes: string[] | undefined): boolean {
  if (!prefixes?.length) return false;
  const c = cleanCode(code) ?? "";
  return prefixes.some((pre) => c.startsWith(pre));
}

/** additional-spice matcher: 32xxx{product}xxxx  (10+ digits; index 5 is product) */
function isSpiceFamily32(code: string, product: "1" | "2") {
  const c = cleanCode(code) ?? "";
  return c.startsWith("32") && c.length >= 6 && c[5] === product;
}
/** same flexible logic for 13-family spice: 13xxx{product}xxxx */
function isSpiceFamily13(code: string, product: "1" | "2") {
  const c = cleanCode(code) ?? "";
  return c.startsWith("13") && c.length >= 6 && c[5] === product;
}
function isSpice(code: string, product: "1" | "2") {
  return isSpiceFamily13(code, product) || isSpiceFamily32(code, product);
}

/* ---------------- payload item extraction ---------------- */
function extractItemsFromPayload(p: any): { code?: string; qty: number }[] {
  const raw = p?.raw_material ?? p?.rawMaterials ?? p?.mavadAvalieh;

  const amtRaw = p?.amount ?? p?.qty ?? p?.quantity ?? p?.value ?? p?.count;
  const amt = typeof amtRaw === "string"
    ? parseFloat(faToEnDigits(amtRaw).replace(/,/g, ""))
    : Number(amtRaw);

  if (typeof raw === "string" || typeof raw === "number") {
    const code = cleanCode(raw);
    const qty = Number.isFinite(amt) ? amt : 0;
    return code && qty > 0 ? [{ code, qty }] : [];
  }

  if (Array.isArray(raw)) {
    const items: { code?: string; qty: number }[] = [];
    for (const r of raw) {
      const rawCode =
        r?.code ?? r?.kardexCode ?? r?.itemCode ??
        r?.kardex?.code ?? r?.item?.code ??
        (typeof r?.name === "string" && /^\d/.test(faToEnDigits(r.name)) ? r.name : undefined);

      const code = cleanCode(rawCode);
      const qRaw = r?.qty ?? r?.quantity ?? r?.amount ?? r?.count ?? r?.value ?? (typeof r === "number" ? r : undefined);
      const qty = typeof qRaw === "string" ? parseFloat(faToEnDigits(qRaw).replace(/,/g, "")) : Number(qRaw);

      if (code && Number.isFinite(qty) && qty !== 0) items.push({ code, qty });
    }
    return items;
  }

  if (raw && typeof raw === "object") {
    return Object.entries(raw)
      .map(([k, v]) => {
        const code = cleanCode(k);
        const qty = typeof v === "string" ? parseFloat(faToEnDigits(v).replace(/,/g, "")) : Number(v);
        return { code, qty };
      })
      .filter((x) => x.code && Number.isFinite(x.qty) && x.qty !== 0);
  }

  return [];
}

/* ---------------- choose group (now with flexible spice) ---------------- */
function matchGroupByCodeForProduct(
  product: ProductKey,
  code?: string
): GroupKey | undefined {
  const c = cleanCode(code);
  if (!c) return;
  const groups = RAW_MATERIAL_GROUPS_BY_PRODUCT[product];

  // First: spice by flexible rule (13/32 families, index 5 == product)
  if (isSpice(c, product)) return "spice";

  // Then fall back to prefixes/patterns for other groups
  for (const g of groups) {
    if (g.key === "spice") continue; // already handled
    if (startsWithAnyPrefix(c, g.prefixes) || matchesAnyPattern(c, g.patterns)) {
      return g.key as GroupKey;
    }
  }
  return;
}

/* ---------------- component ---------------- */
export default async function RawMaterialsSection({
  date,
  hours = 24,
  shifts = [1, 2, 3],
  onlyConfirmed = true,
  product,
}: Props) {
  const wantedShifts = (Array.from(new Set(shifts)) as ShiftNum[]).filter((s): s is ShiftNum => [1, 2, 3].includes(s));
  const GROUPS = RAW_MATERIAL_GROUPS_BY_PRODUCT[product];
  const totals = initTotals(GROUPS);

  // form 1031100 + robust product filters + payload.date
  const entries = await prisma.formEntry.findMany({
    where: {
      form: { code: "1031100" },
      ...(onlyConfirmed ? { status: "finalConfirmed" } : {}),
      AND: [
        {
          OR: [
            { payload: { path: ["date"], equals: date } },
            { payload: { path: ["payloadDate"], equals: date } },
            { payload: { path: ["tarikh"], equals: date } },
            { payload: { path: ["payload", "date"], equals: date } },
          ],
        },
        {
          OR: [
            { payload: { path: ["product"], equals: product } },
            { payload: { path: ["product"], equals: Number(product) } },
            { payload: { path: ["payload", "product"], equals: product } },
            { payload: { path: ["payload", "product"], equals: Number(product) } },
            { payload: { path: ["product", "value"], equals: product } },
            { payload: { path: ["product", "value"], equals: Number(product) } },
          ],
        },
      ],
    },
    select: { id: true, payload: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  // Defensive JS re-check of product value
  const filtered = entries.filter((e) => {
    const p: any = e.payload ?? {};
    let v: any = p?.product ?? p?.payload?.product;
    if (v && typeof v === "object") v = v.value ?? v.code ?? v.id ?? v.key;
    const val = v != null ? String(v) : "";
    return val === product || val === String(Number(product));
  });

  for (const e of filtered) {
    const p = (e.payload as any) ?? {};
    const shift = parseShift(p?.shift ?? p?.workShift ?? p?.shiftNo);
    if (!shift || !wantedShifts.includes(shift)) continue;

    const items = extractItemsFromPayload(p);
    for (const it of items) {
      const g = matchGroupByCodeForProduct(product, it.code);
      if (!g) continue;
      totals[g].shifts[shift] += it.qty;
      totals[g].total += it.qty;
    }
  }

  const hasAny = GROUPS.some(({ key }) => totals[key as GroupKey].total !== 0);

  return (
    <section className="w-full">
      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h2 className="text-xl font-bold">مصرف مواد اولیه</h2>
        </div>

        <div className="p-3">
          {!hasAny ? (
            <div className="text-sm text-gray-600 border rounded-lg p-3">
              رکوردی برای این تاریخ/شیفت‌ها یافت نشد.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[720px] w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-right">
                    <th className="px-3 py-2">ماده اولیه</th>
                    <th className="px-3 py-2">شیفت ۱</th>
                    <th className="px-3 py-2">شیفت ۲</th>
                    <th className="px-3 py-2">شیفت ۳</th>
                    <th className="px-3 py-2">جمع کل</th>
                  </tr>
                </thead>
                <tbody>
                  {GROUPS.map(({ key, labelFa }) => {
                    const row = totals[key as GroupKey];
                    return (
                      <tr key={key} className="border-t">
                        <td className="px-3 py-2 font-medium">{labelFa}</td>
                        <td className="px-3 py-2">{fmtEn(row.shifts[1])}</td>
                        <td className="px-3 py-2">{fmtEn(row.shifts[2])}</td>
                        <td className="px-3 py-2">{fmtEn(row.shifts[3])}</td>
                        <td className="px-3 py-2 font-semibold">{fmtEn(row.total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
