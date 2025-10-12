// app/(protected)/reports/daily-production/components/RawMaterialsDetailsSection.tsx
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type ProductKey = "1" | "2";
type Props = { date: string; product: ProductKey };

/* -------------------- helpers -------------------- */
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
function parseShift(v: any): 1 | 2 | 3 | undefined {
  let x: any = v;
  if (x && typeof x === "object") x = x.value ?? x.key ?? x.id ?? x.code ?? x.labelFa ?? x.label;
  if (typeof x === "string") {
    const m = faToEnDigits(x).match(/(\d)/);
    if (m) x = Number(m[1]);
  }
  return x === 1 || x === 2 || x === 3 ? x : undefined;
}
function toJalali(isoDate: string, useLatinDigits = false): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return isoDate;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
  try {
    const fmt = new Intl.DateTimeFormat(
      useLatinDigits ? "fa-IR-u-ca-persian-nu-latn" : "fa-IR-u-ca-persian",
      { year: "numeric", month: "2-digit", day: "2-digit" }
    );
    return fmt.format(d);
  } catch {
    return isoDate;
  }
}
function normalizeIsoDateLike(input: unknown): string | null {
  if (typeof input !== "string") return null;
  let s = faToEnDigits(input.trim()).replace(/[/.]/g, "-");
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (!m) return null;
  const pad = (n: string) => n.padStart(2, "0");
  return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
}

/** additional-spice matcher: 32xxx{product}xxxx (10+ digits; index 5 is product) */
function isSpiceFamily32(code: string, product: ProductKey) {
  const c = cleanCode(code) ?? "";
  return c.startsWith("32") && c.length >= 6 && c[5] === product;
}

/* -------------------- group definitions -------------------- */
const GROUPS = [
  { key: "corn",   labelFa: "ذرت / ذرت پاپکورن" },
  { key: "oil",    labelFa: "روغن" },
  { key: "lime",   labelFa: "آهک" },
  { key: "spice",  labelFa: "ادویه" },
  { key: "selfon", labelFa: "سلفون" },
  { key: "box",    labelFa: "کارتن" },
] as const;
type GroupKey = typeof GROUPS[number]["key"];

function matchGroupByCode(code: string | undefined, product: ProductKey): GroupKey | undefined {
  const s = cleanCode(code);
  if (!s) return;
  // corn
  if (product === "1" && s.startsWith("110")) return "corn";
  if (product === "2" && s.startsWith("112")) return "corn";
  // oil / lime
  if (s.startsWith("1204")) return "oil";
  if (s.startsWith("1522")) return "lime";
  // spice (13…{product}… or 32…{product}…)
  if (s.startsWith("13") && s.length >= 6 && s[5] === product) return "spice";
  if (isSpiceFamily32(s, product)) return "spice";
  // packaging (product-coded in 6th digit)
  if (s.startsWith("22") && s.length >= 6 && s[5] === product) return "selfon";
  if (s.startsWith("21") && s.length >= 6 && s[5] === product) return "box";
  return;
}

/* -------------------- types -------------------- */
type TxnRow = {
  dateFa: string;                  // Jalali of payload.date
  shift?: 1 | 2 | 3;
  unitCode?: string | null;        // payload.unit code
  unitName?: string | null;        // from FixedInformation.title
  code: string;                    // raw material code
  nameFa?: string | null;          // from KardexItem.nameFa
  amount: number;                  // may be negative for returns
  description?: string | null;
  kind: "consume" | "return";      // 1031100 vs 1031000 (source=1)
};

export default async function RawMaterialsDetailsSection({ date, product }: Props) {
  // POSITIVE: 1031100
  const consume = await prisma.formEntry.findMany({
    where: {
      form: { code: "1031100" },
      status: "finalConfirmed",
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
    select: { id: true, payload: true, finalConfirmedAt: true, createdAt: true },
    orderBy: { finalConfirmedAt: "asc" },
  });

  // NEGATIVE (returns): 1031000 with source == 1
  const returns = await prisma.formEntry.findMany({
    where: {
      form: { code: "1031000" },
      status: "finalConfirmed",
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
    select: { id: true, payload: true, finalConfirmedAt: true, createdAt: true },
    orderBy: { finalConfirmedAt: "asc" },
  });

  // Prepare group buckets
  const groups = new Map<GroupKey, { labelFa: string; total: number; rows: TxnRow[] }>();
  for (const g of GROUPS) groups.set(g.key, { labelFa: g.labelFa, total: 0, rows: [] });

  // Collect lookups
  const matCodes = new Set<string>();
  const unitCodes = new Set<string>();

  function maybePushRow(p: any, sign: 1 | -1, kind: "consume" | "return") {
    const code = cleanCode(p?.raw_material ?? p?.rawMaterials ?? p?.mavadAvalieh);
    const amountAbs = parseAmount(p?.amount ?? p?.qty ?? p?.quantity ?? p?.value ?? p?.count);
    if (!code || !Number.isFinite(amountAbs) || amountAbs === 0) return;

    const key = matchGroupByCode(code, product);
    if (!key) return;

    const payloadDate = normalizeIsoDateLike(p?.date) || date;
    const row: TxnRow = {
      dateFa: toJalali(payloadDate),
      shift: parseShift(p?.shift ?? p?.workShift ?? p?.shiftNo),
      unitCode: p?.unit ?? null,
      unitName: null,
      code,
      nameFa: null,
      amount: sign * amountAbs, // ← sign applied here
      description: p?.description ?? null,
      kind,
    };

    matCodes.add(code);
    if (row.unitCode) unitCodes.add(String(row.unitCode));

    const bucket = groups.get(key)!;
    bucket.rows.push(row);
    bucket.total += row.amount;
  }

  for (const e of consume) maybePushRow((e.payload as any) ?? {}, +1, "consume");
  for (const e of returns) maybePushRow((e.payload as any) ?? {}, -1, "return");

  // Look up raw material names in KardexItem
  if (matCodes.size) {
    const items = await prisma.kardexItem.findMany({
      where: { code: { in: [...matCodes] } },
      select: { code: true, nameFa: true },
    });
    const nameMap = new Map(items.map((i) => [i.code, i.nameFa]));
    for (const g of groups.values()) {
      for (const r of g.rows) r.nameFa = nameMap.get(r.code) ?? r.nameFa ?? null;
    }
  }

  // Look up unit names in FixedInformation (code -> title)
  if (unitCodes.size) {
    const infos = await prisma.fixedInformation.findMany({
      where: { code: { in: [...unitCodes] } },
      select: { code: true, title: true },
    });
    const unitMap = new Map(infos.map((u) => [u.code, u.title]));
    for (const g of groups.values()) {
      for (const r of g.rows) {
        if (r.unitCode) r.unitName = unitMap.get(String(r.unitCode)) ?? String(r.unitCode);
      }
    }
  }

  // Keep only groups with rows
  const present = GROUPS
    .map(({ key, labelFa }) => {
      const bucket = groups.get(key)!;
      return { key, labelFa, rows: bucket.rows, total: bucket.total };
    })
    .filter((g) => g.rows.length > 0);

  const nf = (n: number) =>
    n.toLocaleString("en-US", { maximumFractionDigits: 3, minimumFractionDigits: 0 });

  return (
    <section className="w-full">
      <h2 className="text-xl font-bold mb-3">جزئیات تراکنش مواد اولیه</h2>

      {present.length === 0 ? (
        <div className="text-sm text-gray-600 border rounded-lg p-3">
          برای این تاریخ، تراکنشی یافت نشد.
        </div>
      ) : (
        <div className="space-y-6">
          {present.map((g) => (
            <div key={g.key} className="border rounded-lg">
              <div className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-t-lg">
                <div className="font-semibold">{g.labelFa}</div>
                <div className="text-sm">
                  جمع مقدار: <span className="font-bold">{nf(g.total)}</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-[1000px] w-full text-sm text-center">
                  <thead>
                    <tr className="bg-white">
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">تاریخ</th>
                      <th className="px-3 py-2">شیفت</th>
                      <th className="px-3 py-2">کد ماده اولیه</th>
                      <th className="px-3 py-2">نام ماده اولیه</th>
                      <th className="px-3 py-2">مقدار</th>
                      <th className="px-3 py-2">نوع</th>
                      <th className="px-3 py-2">توضیحات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.rows.map((r, i) => (
                      <tr key={`${g.key}-${i}`} className="border-t">
                        <td className="px-3 py-2">{i + 1}</td>
                        <td className="px-3 py-2">{r.dateFa}</td>
                        <td className="px-3 py-2">{r.shift ?? ""}</td>
                        <td className="px-3 py-2" dir="ltr">{r.code}</td>
                        <td className="px-3 py-2">{r.nameFa ?? ""}</td>
                        <td className="px-3 py-2 font-medium">{nf(r.amount)}</td>
                        <td className="px-3 py-2">{r.kind === "return" ? "مرجوعی" : "مصرف"}</td>
                        <td className="px-3 py-2">{r.description ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-gray-50 font-semibold">
                      <td className="px-3 py-2" colSpan={5}>جمع</td>
                      <td className="px-3 py-2">{nf(g.total)}</td>
                      <td className="px-3 py-2" colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
