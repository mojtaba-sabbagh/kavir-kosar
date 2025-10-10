// app/(protected)/reports/daily-production/components/ProductsDetailsSection.tsx
import { prisma } from "@/lib/db";
import type { ProductKey } from "@/lib/report-helpers";

export const dynamic = "force-dynamic";

type Props = { date: string; product: ProductKey };

/* ---------- helpers (unchanged + small additions) ---------- */
function faToEnDigits(s: any): string {
  const str = String(s ?? "");
  const map: Record<string, string> = {
    "۰":"0","۱":"1","۲":"2","۳":"3","۴":"4","۵":"5","۶":"6","۷":"7","۸":"8","۹":"9",
    "٠":"0","١":"1","٢":"2","٣":"3","٤":"4","٥":"5","٦":"6","٧":"7","٨":"8","٩":"9",
  };
  return str.replace(/[0-9۰-۹٠-٩]/g, (ch) => map[ch] ?? ch);
}
function cleanCode(input: any): string | undefined {
  const s = faToEnDigits(input);
  const digits = s.replace(/[^\d]/g, "");
  return digits || undefined;
}
function parseNumber(v: any): number {
  if (v == null || v === "") return NaN;
  return typeof v === "string" ? parseFloat(faToEnDigits(v).replace(/,/g, "")) : Number(v);
}
function parseAmount(v: any): number {
  const n = parseNumber(v);
  return Number.isFinite(n) ? n : 0;
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
function isSourceOne(v: any): boolean {
  const n = Number(faToEnDigits(v));
  return n === 1;
}
function toJalali(isoDate: string, latn = false): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return isoDate;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
  try {
    return new Intl.DateTimeFormat(
      latn ? "fa-IR-u-ca-persian-nu-latn" : "fa-IR-u-ca-persian",
      { year: "numeric", month: "2-digit", day: "2-digit" }
    ).format(d);
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
const prefixFor = (product: ProductKey) => (product === "2" ? "42" : "41");

/** Extract *count-based* products from payload.product / payload.products */
function extractCountProducts(p: any): { code: string; amount: number }[] {
  const amountTop = parseAmount(p?.amount ?? p?.qty ?? p?.quantity ?? p?.count ?? p?.value);
  const prod = p?.product ?? p?.products;
  const out: { code: string; amount: number }[] = [];

  if (typeof prod === "string" || typeof prod === "number") {
    const code = cleanCode(prod);
    if (code && amountTop !== 0) out.push({ code, amount: amountTop });
    return out;
  }
  if (Array.isArray(prod)) {
    for (const r of prod) {
      const rawCode =
        r?.code ?? r?.kardexCode ?? r?.itemCode ?? r?.kardex?.code ?? r?.item?.code ?? r?.name;
      const code = cleanCode(rawCode);
      const a = parseAmount(r?.amount ?? r?.qty ?? r?.quantity ?? r?.count ?? amountTop);
      if (code && a !== 0) out.push({ code, amount: a });
    }
    return out;
  }
  if (prod && typeof prod === "object") {
    for (const [k, v] of Object.entries(prod)) {
      const code = cleanCode(k);
      const a = parseAmount(v);
      if (code && a !== 0) out.push({ code, amount: a });
    }
  }
  return out;
}

/** Extract *weight-based* rows from payload.raw_material when it starts with 41/42 */
function extractWeightRows(p: any): { code: string; kg: number }[] {
  const code = cleanCode(p?.raw_material ?? p?.rawMaterial ?? p?.material ?? p?.code);
  const amount = parseAmount(p?.amount ?? p?.qty ?? p?.quantity ?? p?.count ?? p?.value);
  if (!code || amount === 0) return [];
  // Only accept “product-like” raw_materials
  if (code.startsWith("41") || code.startsWith("42")) return [{ code, kg: amount }];
  return [];
}

/* ---------- types ---------- */
type Row = {
  dateFa: string;            // Jalali of payload.date
  shift?: 1 | 2 | 3;
  unitCode?: string | null;  // payload.unit (FixedInformation lookup)
  unitName?: string | null;  // FixedInformation.title
  code: string;              // product code
  nameFa?: string | null;    // KardexItem.nameFa
  amount: number;            // count OR kg (when weightBased)
  weight: number;            // final kg to show
  weightBased: boolean;      // true when coming from raw_material 41/42 (amount is kg)
  note?: string | null;
};

export default async function ProductsDetailsSection({ date, product }: Props) {
  const wantedPrefix = prefixFor(product);

  // fetch entries for the day, finalConfirmed
  const entries = await prisma.formEntry.findMany({
    where: {
      form: { code: "1031000" },
      status: "finalConfirmed",
      payload: { path: ["date"], equals: date },
    },
    select: { id: true, payload: true },
    orderBy: { id: "asc" },
  });

  // Build rows; collect codes (for Kardex) and unit codes (for FixedInformation)
  const rows: Row[] = [];
  const codes = new Set<string>();
  const unitCodes = new Set<string>();

  for (const e of entries) {
    const p = (e.payload as any) ?? {};
    if (!isSourceOne(p?.source)) continue; // include only source == 1

    const shift = parseShift(p?.shift);
    const unitCode = p?.unit ?? null;
    if (unitCode) unitCodes.add(String(unitCode));

    const payloadDate = normalizeIsoDateLike(p?.date) || date;
    const dateFa = toJalali(payloadDate);

    // 1) count-based via payload.product
    const countItems = extractCountProducts(p).filter((it) => it.code.startsWith(wantedPrefix));

    // 2) weight-based via payload.raw_material (amount already kg)
    const weightItems = extractWeightRows(p).filter((it) => it.code.startsWith(wantedPrefix));

    if (countItems.length === 0 && weightItems.length === 0) continue;

    // push rows
    for (const it of countItems) {
      codes.add(it.code);
      rows.push({
        dateFa,
        shift,
        unitCode,
        unitName: null,
        code: it.code,
        nameFa: null,
        amount: it.amount,     // count
        weight: 0,             // fill after Kardex
        weightBased: false,
        note: p?.description ?? null,
      });
    }
    for (const it of weightItems) {
      codes.add(it.code);
      rows.push({
        dateFa,
        shift,
        unitCode,
        unitName: null,
        code: it.code,
        nameFa: null,
        amount: it.kg,         // already kg
        weight: it.kg,         // show kg directly
        weightBased: true,     // block re-multiplication
        note: p?.description ?? null,
      });
    }
  }

  // 1) Names + per-unit weight from KardexItem.extra.weight (only for count-based rows)
  if (codes.size) {
    const items = await prisma.kardexItem.findMany({
      where: { code: { in: [...codes] } },
      select: { code: true, nameFa: true, extra: true },
    });
    const itemMap = new Map(items.map((i) => [i.code, i]));
    for (const r of rows) {
      const it = itemMap.get(r.code);
      if (it) {
        r.nameFa = it.nameFa ?? r.nameFa ?? null;
        if (!r.weightBased) {
          const perUnitWeight = parseNumber((it as any)?.extra?.weight);
          const w = Number.isFinite(perUnitWeight) ? perUnitWeight : 0;
          r.weight = r.amount * w;
        }
      }
    }
  }

  // 2) Unit names from FixedInformation (code -> title)
  if (unitCodes.size) {
    const units = await prisma.fixedInformation.findMany({
      where: { code: { in: [...unitCodes] } },
      select: { code: true, title: true },
    });
    const unitMap = new Map(units.map((u) => [String(u.code), u.title]));
    for (const r of rows) {
      if (r.unitCode) r.unitName = unitMap.get(String(r.unitCode)) ?? String(r.unitCode);
    }
  }

  const nf = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 3 });

  // group by code for display (each product gets its own table)
  const byCode = new Map<string, Row[]>();
  for (const r of rows) {
    if (!byCode.has(r.code)) byCode.set(r.code, []);
    byCode.get(r.code)!.push(r);
  }

  const present = [...byCode.entries()].map(([code, rs]) => {
    const nameFa = rs[0]?.nameFa ?? "";
    const totalAmount = rs.reduce((s, x) => s + x.amount, 0);
    const totalWeight = rs.reduce((s, x) => s + x.weight, 0);
    return { code, nameFa, rows: rs, totalAmount, totalWeight };
  });

  return (
    <section className="w-full">
      <h2 className="text-xl font-bold mb-3">جزئیات تولید</h2>

      {present.length === 0 ? (
        <div className="text-sm text-gray-600 border rounded-lg p-3">
          برای این تاریخ، رکورد تولید یافت نشد.
        </div>
      ) : (
        <div className="space-y-6">
          {present.map((g) => (
            <div key={g.code} className="border rounded-lg">
              <div className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-t-lg">
                <div className="font-semibold">
                  {g.nameFa || "بدون نام"} <span className="text-xs text-gray-500" dir="ltr">({g.code})</span>
                </div>
                <div className="text-sm">
                  جمع مقدار: <span className="font-bold">{nf(g.totalAmount)}</span>
                  <span className="mx-2">|</span>
                  جمع وزن: <span className="font-bold">{nf(g.totalWeight)}</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-[1000px] w-full text-sm text-center">
                  <thead>
                    <tr className="bg-white">
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">تاریخ</th>
                      <th className="px-3 py-2">شیفت</th>
                      <th className="px-3 py-2">کد محصول</th>
                      <th className="px-3 py-2">نام محصول</th>
                      <th className="px-3 py-2">تعداد/مقدار</th>
                      <th className="px-3 py-2">واحد</th>
                      <th className="px-3 py-2">وزن (کیلوگرم)</th>
                      <th className="px-3 py-2">توضیحات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.rows.map((r, i) => (
                      <tr key={`${g.code}-${i}`} className="border-t">
                        <td className="px-3 py-2">{i + 1}</td>
                        <td className="px-3 py-2">{r.dateFa}</td>
                        <td className="px-3 py-2">{r.shift ?? ""}</td>
                        <td className="px-3 py-2" dir="ltr">{r.code}</td>
                        <td className="px-3 py-2">{r.nameFa ?? ""}</td>
                        <td className="px-3 py-2">{nf(r.amount)}</td>
                        <td className="px-3 py-2">{r.unitName ?? ""}</td>
                        <td className="px-3 py-2">{nf(r.weight)}</td>
                        <td className="px-3 py-2">{r.note ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-gray-50 font-semibold">
                      <td className="px-3 py-2" colSpan={6}>جمع</td>
                      <td className="px-3 py-2">{nf(g.totalAmount)}</td>
                      <td className="px-3 py-2">{nf(g.totalWeight)}</td>
                      <td className="px-3 py-2"></td>
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
