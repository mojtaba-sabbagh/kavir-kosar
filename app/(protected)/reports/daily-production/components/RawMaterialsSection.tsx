import { prisma } from "@/lib/db";
export const dynamic = "force-dynamic";

/** Product key is always "1" (چیپس) or "2" (پاپکورن) */
export type ProductKey = "1" | "2";

/* ---------------- helpers ---------------- */
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
function parseAmount(v: any): number {
  if (typeof v === "string") return parseFloat(faToEnDigits(v).replace(/,/g, ""));
  return Number(v);
}
type ShiftNum = 1 | 2 | 3;
function parseShift(value: any): ShiftNum | undefined {
  const n = Number(faToEnDigits(value));
  return n === 1 || n === 2 || n === 3 ? (n as ShiftNum) : undefined;
}
/** English number (LTR) with minus sign before digits (works in RTL UIs) */
function fmtEN(n: number, frac = 3): string {
  const abs = Math.abs(n).toLocaleString("en-US", {
    maximumFractionDigits: frac,
    minimumFractionDigits: 0,
  });
  return n < 0 ? `-${abs}` : abs;
}

/** Wildcard matcher for patterns like "13***1****" */
function matchesPattern(pattern: string, code: string): boolean {
  const p = pattern.replace(/\*/g, "\\d");
  return new RegExp("^" + p + "$").test(code);
}
/** extra spice family: 32xxx{product}xxxx (10+ digits; index 5 = product) */
function isSpiceFamily32(code: string, product: ProductKey) {
  const c = cleanCode(code) ?? "";
  return c.startsWith("32") && c.length >= 6 && c[5] === product;
}

/* ---------------- grouping by product ---------------- */
const RAW_MATERIAL_GROUPS_BY_PRODUCT: Record<
  ProductKey,
  Array<{ key: GroupKey; labelFa: string; prefixes?: string[]; patterns?: string[] }>
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
} as const;

type GroupKey = "corn" | "oil" | "lime" | "spice" | "selfon" | "box";
type Totals = Record<GroupKey, { shifts: Record<ShiftNum, number>; total: number }>;

function initTotals(groups: typeof RAW_MATERIAL_GROUPS_BY_PRODUCT[ProductKey]): Totals {
  const base = Object.fromEntries(
    groups.map(g => [g.key, { shifts: { 1: 0, 2: 0, 3: 0 } as Record<ShiftNum, number>, total: 0 }])
  ) as Totals;
  return base;
}

function belongsToGroup(code: string, g: { prefixes?: string[]; patterns?: string[] }, product: ProductKey): boolean {
  if (!code) return false;
  if (g.prefixes?.some(p => code.startsWith(p))) return true;
  if (g.patterns?.some(pat => matchesPattern(pat, code))) return true;
  // explicit extra family for spices
  if (g.patterns && g.patterns.some(p => p.startsWith("32***")) && isSpiceFamily32(code, product)) return true;
  return false;
}

/* ---------------- props ---------------- */
type Props = {
  date: string;                   // yyyy-mm-dd (Gregorian)
  hours?: number;                 // used only for per-hour calc (if you keep it)
  shifts?: (1 | 2 | 3)[];         // defaults to [1,2,3]
  onlyConfirmed?: boolean;        // default true
  product: ProductKey;            // "1" chips | "2" popcorn
};

/* -------------------------------- component -------------------------------- */
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

  // + consumption from 1031100 (filtered by date + product)
  const plusEntries = await prisma.formEntry.findMany({
    where: {
      form: { code: "1031100" },
      ...(onlyConfirmed ? { status: "finalConfirmed" as const } : {}),
      AND: [
        { payload: { path: ["date"], equals: date } },
        { payload: { path: ["product"], equals: product } },
      ],
    },
    select: { id: true, payload: true },
    orderBy: { id: "asc" },
  });

  // - returns from 1031000 with source = 1 (filtered by date + product)
  const minusEntries = await prisma.formEntry.findMany({
    where: {
      form: { code: "1031000" },
      ...(onlyConfirmed ? { status: "finalConfirmed" as const } : {}),
      AND: [
        { payload: { path: ["date"], equals: date } },
        { payload: { path: ["source"], equals: "1" } },
        { payload: { path: ["product"], equals: product } },
      ],
    },
    select: { id: true, payload: true },
    orderBy: { id: "asc" },
  });

  const apply = (sign: 1 | -1, payload: any) => {
    const code = cleanCode(
      payload?.raw_material ??
      payload?.rawMaterials ??
      payload?.mavadAvalieh ??
      payload?.code
    );
    const amount = parseAmount(
      payload?.amount ?? payload?.qty ?? payload?.quantity ?? payload?.value ?? payload?.count
    );
    if (!code || !Number.isFinite(amount) || amount === 0) return;

    const shift = parseShift(payload?.shift ?? payload?.workShift ?? payload?.shiftNo);
    const gDef = GROUPS.find(g => belongsToGroup(code, g, product));
    if (!gDef) return;

    const s = shift && wantedShifts.includes(shift) ? shift : undefined;
    const val = sign * amount;

    totals[gDef.key].total += val;
    if (s) totals[gDef.key].shifts[s] += val;
  };

  for (const e of plusEntries) apply(1, (e.payload as any) ?? {});
  for (const e of minusEntries) apply(-1, (e.payload as any) ?? {});

  const hasAny = GROUPS.some(({ key }) => totals[key].total !== 0);

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
                  <tr className="text-center">
                    <th className="px-3 py-2">ماده اولیه</th>
                    <th className="px-3 py-2">شیفت ۱</th>
                    <th className="px-3 py-2">شیفت ۲</th>
                    <th className="px-3 py-2">شیفت ۳</th>
                    <th className="px-3 py-2">جمع کل</th>
                  </tr>
                </thead>
                <tbody>
                  {GROUPS.map(({ key, labelFa }) => {
                    const row = totals[key];
                    return (
                      <tr key={key} className="border-t text-center">
                        <td className="px-3 py-2 font-medium">{labelFa}</td>
                        <td className={`px-3 py-2 ${row.shifts[1] < 0 ? "text-red-600" : ""}`} dir="ltr">
                          {fmtEN(row.shifts[1])}
                        </td>
                        <td className={`px-3 py-2 ${row.shifts[2] < 0 ? "text-red-600" : ""}`} dir="ltr">
                          {fmtEN(row.shifts[2])}
                        </td>
                        <td className={`px-3 py-2 ${row.shifts[3] < 0 ? "text-red-600" : ""}`} dir="ltr">
                          {fmtEN(row.shifts[3])}
                        </td>
                        <td className={`px-3 py-2 font-semibold ${row.total < 0 ? "text-red-600" : ""}`} dir="ltr">
                          {fmtEN(row.total)}
                        </td>
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
