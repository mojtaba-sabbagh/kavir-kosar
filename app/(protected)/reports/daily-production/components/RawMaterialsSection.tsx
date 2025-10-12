// app/(protected)/reports/daily-production/components/RawMaterialsSection.tsx
import { prisma } from "@/lib/db";
export const dynamic = "force-dynamic";

type ProductKey = "1" | "2";

type Props = {
  date: string;
  hours?: number;
  shifts?: (1 | 2 | 3)[];
  onlyConfirmed?: boolean;
  product: ProductKey;
};

/* ---------- helpers ---------- */
function faToEnDigits(s: string): string {
  const map: Record<string, string> = {
    "۰":"0","۱":"1","۲":"2","۳":"3","۴":"4","۵":"5","۶":"6","۷":"7","۸":"8","۹":"9",
    "٠":"0","١":"1","٢":"2","٣":"3","٤":"4","٥":"5","٦":"6","٧":"7","٨":"8","٩":"9",
  };
  return String(s ?? "").replace(/[0-9۰-۹٠-٩]/g, ch => map[ch] ?? ch);
}
function cleanCode(input: any): string | undefined {
  if (input == null) return undefined;
  const s = faToEnDigits(String(input));
  const digits = s.replace(/[^\d]/g, "");
  return digits || undefined;
}
function parseShift(value: any): 1 | 2 | 3 | undefined {
  const n = Number(value?.value ?? value);
  return n === 1 || n === 2 || n === 3 ? n : undefined;
}
function parseAmount(v: any): number {
  if (typeof v === "string") return parseFloat(faToEnDigits(v).replace(/,/g, ""));
  return Number(v);
}
function isSpiceFamily32(code: string, product: ProductKey) {
  const c = cleanCode(code) ?? "";
  return c.startsWith("32") && c.length >= 6 && c[5] === product;
}

/* ---------- groups ---------- */
const RAW_MATERIAL_GROUPS = [
  { key: "corn",    labelFa: "ذرت / ذرت پاپکورن" },
  { key: "oil",     labelFa: "روغن" },
  { key: "lime",    labelFa: "آهک" },
  { key: "spice",   labelFa: "ادویه" },
  { key: "selfon",  labelFa: "سلفون" },
  { key: "box",     labelFa: "کارتن" },
] as const;
type GroupKey = typeof RAW_MATERIAL_GROUPS[number]["key"];
type ShiftNum = 1 | 2 | 3;

function matchGroupByCode(code: string | undefined, product: ProductKey): GroupKey | undefined {
  const s = cleanCode(code);
  if (!s) return;
  if (product === "1" && s.startsWith("110")) return "corn";
  if (product === "2" && s.startsWith("112")) return "corn";
  if (s.startsWith("1204")) return "oil";
  if (s.startsWith("1522")) return "lime";
  if (s.startsWith("13") && s.length >= 6 && s[5] === product) return "spice";
  if (isSpiceFamily32(s, product)) return "spice";
  if (s.startsWith("22") && s.length >= 6 && s[5] === product) return "selfon";
  if (s.startsWith("21") && s.length >= 6 && s[5] === product) return "box";
  return;
}

type Totals = Record<GroupKey, { shifts: Record<ShiftNum, number>; total: number }>;
function initTotals(): Totals {
  return {
    corn:   { shifts: {1:0,2:0,3:0}, total: 0 },
    oil:    { shifts: {1:0,2:0,3:0}, total: 0 },
    lime:   { shifts: {1:0,2:0,3:0}, total: 0 },
    spice:  { shifts: {1:0,2:0,3:0}, total: 0 },
    selfon: { shifts: {1:0,2:0,3:0}, total: 0 },
    box:    { shifts: {1:0,2:0,3:0}, total: 0 },
  };
}

export default async function RawMaterialsSection({
  date,
  hours = 24,
  shifts = [1, 2, 3],
  onlyConfirmed = true,
  product,
}: Props) {
  const wantedShifts = (Array.from(new Set(shifts)) as ShiftNum[]).filter(
    (s): s is ShiftNum => [1, 2, 3].includes(s)
  );
  const totals = initTotals();

  const statusCond = onlyConfirmed ? { status: "finalConfirmed" as const } : {};

  // + consumption (1031100)
  const pos = await prisma.formEntry.findMany({
    where: {
      ...statusCond,
      form: { code: "1031100" },
      AND: [
        { payload: { path: ["date"], equals: date } },
        {
          OR: [
            { payload: { path: ["product"], equals: product } },
            { payload: { path: ["product"], equals: Number(product) } as any },
            { payload: { path: ["product", "value"], equals: product } },
            { payload: { path: ["product", "value"], equals: Number(product) } as any },
          ],
        },
      ],
    },
    select: { id: true, payload: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  // − returns (1031000 with source=1)
  const neg = await prisma.formEntry.findMany({
    where: {
      ...statusCond,
      form: { code: "1031000" },
      AND: [
        { payload: { path: ["date"], equals: date } },
        {
          OR: [
            { payload: { path: ["source"], equals: "1" } },
            { payload: { path: ["source"], equals: 1 } as any },
            { payload: { path: ["source", "value"], equals: "1" } },
            { payload: { path: ["source", "value"], equals: 1 } as any },
          ],
        },
        {
          OR: [
            { payload: { path: ["product"], equals: product } },
            { payload: { path: ["product"], equals: Number(product) } as any },
            { payload: { path: ["product", "value"], equals: product } },
            { payload: { path: ["product", "value"], equals: Number(product) } as any },
          ],
        },
      ],
    },
    select: { id: true, payload: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  function applyEntry(e: any, sign: 1 | -1) {
    const p = (e.payload ?? {}) as any;
    const code = cleanCode(p?.raw_material ?? p?.rawMaterials ?? p?.mavadAvalieh);
    const amountAbs = parseAmount(p?.amount ?? p?.qty ?? p?.quantity ?? p?.value ?? p?.count);
    if (!code || !Number.isFinite(amountAbs) || amountAbs === 0) return;
    const shift = parseShift(p?.shift ?? p?.workShift ?? p?.shiftNo);
    const g = matchGroupByCode(code, product);
    if (!g) return;

    const amt = sign * amountAbs;
    if (shift && wantedShifts.includes(shift)) totals[g].shifts[shift] += amt;
    totals[g].total += amt;
  }

  pos.forEach((e) => applyEntry(e, +1));
  neg.forEach((e) => applyEntry(e, -1));

  const hasAny = RAW_MATERIAL_GROUPS.some(({ key }) => totals[key].total !== 0);
  const nf = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 3, minimumFractionDigits: 0 });

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
              <table className="min-w-[720px] w-full text-sm text-center">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-right">ماده اولیه</th>
                    <th className="px-3 py-2">شیفت ۱</th>
                    <th className="px-3 py-2">شیفت ۲</th>
                    <th className="px-3 py-2">شیفت ۳</th>
                    <th className="px-3 py-2">جمع کل</th>
                  </tr>
                </thead>
                <tbody>
                  {RAW_MATERIAL_GROUPS.map(({ key, labelFa }) => {
                    const row = totals[key];
                    return (
                      <tr key={key} className="border-t">
                        <td className="px-3 py-2 text-right font-medium">{labelFa}</td>
                        <td className="px-3 py-2">{nf(row.shifts[1])}</td>
                        <td className="px-3 py-2">{nf(row.shifts[2])}</td>
                        <td className="px-3 py-2">{nf(row.shifts[3])}</td>
                        <td className="px-3 py-2 font-semibold">{nf(row.total)}</td>
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
