// app/(protected)/reports/daily-production/components/ProductsSummarySection.tsx
import { prisma } from "@/lib/db";
import type { ProductKey } from "@/lib/report-helpers";

export const dynamic = "force-dynamic";

type Props = { date: string; product: ProductKey };

/* helpers (same as details, trimmed where not needed) */
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
function isSourceOne(v: any): boolean { return Number(faToEnDigits(v)) === 1; }
function toJalali(isoDate: string, latn = false): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return isoDate;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
  try {
    return new Intl.DateTimeFormat(
      latn ? "fa-IR-u-ca-persian-nu-latn" : "fa-IR-u-ca-persian",
      { year: "numeric", month: "2-digit", day: "2-digit" }
    ).format(d);
  } catch { return isoDate; }
}
const prefixFor = (product: ProductKey) => (product === "2" ? "42" : "41");

type Agg = {
  code: string;
  nameFa?: string | null;
  shifts: Record<1 | 2 | 3, number>; // sum of amount (count or kg) just like details
  totalAmount: number;               // count or kg (if weight-based rows)
  totalWeight: number;               // final kg
  weightBasedAny: boolean;           // to know if some rows are weight-based
};

export default async function ProductsSummarySection({ date, product }: Props) {
  const wantedPrefix = prefixFor(product);

  const entries = await prisma.formEntry.findMany({
    where: {
      form: { code: "1031000" },
      status: "finalConfirmed",
      payload: { path: ["date"], equals: date },
    },
    select: { id: true, payload: true },
    orderBy: { id: "asc" },
  });

  // aggregate amounts per code and shift
  const byCode = new Map<string, Agg>();
  const codes = new Set<string>();

  const extractCount = (p: any) => {
    const amountTop = parseAmount(p?.amount ?? p?.qty ?? p?.quantity ?? p?.count ?? p?.value);
    const prod = p?.product ?? p?.products;

    if (typeof prod === "string" || typeof prod === "number") {
      const code = cleanCode(prod);
      return code && amountTop !== 0 ? [{ code, amount: amountTop }] : [];
    }
    if (Array.isArray(prod)) {
      const out: { code: string; amount: number }[] = [];
      for (const r of prod) {
        const rawCode =
          r?.code ?? r?.kardexCode ?? r?.itemCode ??
          r?.kardex?.code ?? r?.item?.code ?? r?.name;
        const code = cleanCode(rawCode);
        const a = parseAmount(r?.amount ?? r?.qty ?? r?.quantity ?? r?.count ?? amountTop);
        if (code && a !== 0) out.push({ code, amount: a });
      }
      return out;
    }
    if (prod && typeof prod === "object") {
      return Object.entries(prod).map(([k, v]) => ({
        code: cleanCode(k)!,
        amount: parseAmount(v),
      }));
    }
    return [];
  };

  const extractWeight = (p: any) => {
    const code = cleanCode(p?.raw_material ?? p?.rawMaterial ?? p?.material ?? p?.code);
    const amount = parseAmount(p?.amount ?? p?.qty ?? p?.quantity ?? p?.count ?? p?.value);
    if (!code || amount === 0) return [];
    return code.startsWith("41") || code.startsWith("42") ? [{ code, kg: amount }] : [];
  };

  const getAgg = (code: string): Agg => {
    if (!byCode.has(code)) {
      byCode.set(code, {
        code,
        nameFa: undefined,
        shifts: { 1: 0, 2: 0, 3: 0 },
        totalAmount: 0,
        totalWeight: 0,
        weightBasedAny: false,
      });
    }
    return byCode.get(code)!;
  };

  for (const e of entries) {
    const p = (e.payload as any) ?? {};
    if (!isSourceOne(p?.source)) continue;
    const s = parseShift(p?.shift);
    if (!s) continue;

    // count-based
    for (const it of extractCount(p).filter((i) => i.code.startsWith(wantedPrefix))) {
      const a = getAgg(it.code);
      a.shifts[s] += it.amount;
      a.totalAmount += it.amount;
      codes.add(it.code);
    }
    // weight-based
    for (const it of extractWeight(p).filter((i) => i.code.startsWith(wantedPrefix))) {
      const a = getAgg(it.code);
      a.shifts[s] += it.kg;     // treat amount as kg for shifts too
      a.totalAmount += it.kg;   // keep consistent with details "amount/مقدار"
      a.totalWeight += it.kg;   // final kg
      a.weightBasedAny = true;
      codes.add(it.code);
    }
  }

  // add names + per-unit weights for count-based totals
  if (codes.size) {
    const items = await prisma.kardexItem.findMany({
      where: { code: { in: [...codes] } },
      select: { code: true, nameFa: true, extra: true },
    });
    const map = new Map(items.map((i) => [i.code, i]));
    for (const a of byCode.values()) {
      const it = map.get(a.code);
      if (it) {
        a.nameFa = it.nameFa ?? a.nameFa;
        // Only multiply counts when we *didn't* already inject weight-based rows
        if (!a.weightBasedAny) {
          const perUnitWeight = parseNumber((it as any)?.extra?.weight);
          const w = Number.isFinite(perUnitWeight) ? perUnitWeight : 0;
          a.totalWeight = a.totalAmount * w;
        }
      }
    }
  }

  const rows = [...byCode.values()].sort((x, y) => (x.nameFa || "").localeCompare(y.nameFa || "", "fa"));
  const nf = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 3 });
  const hasAny = rows.length > 0;

  return (
    <section className="w-full">
      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h2 className="text-xl font-bold">خلاصه تولید</h2>
        </div>

        <div className="p-3">
          {!hasAny ? (
            <div className="text-sm text-gray-600 border rounded-lg p-3">
              برای این تاریخ، خلاصه‌ای وجود ندارد.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full text-sm text-center">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2">نام محصول</th>
                    <th className="px-3 py-2">کد</th>
                    <th className="px-3 py-2">شیفت ۱</th>
                    <th className="px-3 py-2">شیفت ۲</th>
                    <th className="px-3 py-2">شیفت ۳</th>
                    <th className="px-3 py-2">جمع مقدار</th>
                    <th className="px-3 py-2">جمع وزن</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.code} className="border-t">
                      <td className="px-3 py-2">{r.nameFa ?? "بدون نام"}</td>
                      <td className="px-3 py-2" dir="ltr">{r.code}</td>
                      <td className="px-3 py-2">{nf(r.shifts[1])}</td>
                      <td className="px-3 py-2">{nf(r.shifts[2])}</td>
                      <td className="px-3 py-2">{nf(r.shifts[3])}</td>
                      <td className="px-3 py-2 font-semibold">{nf(r.totalAmount)}</td>
                      <td className="px-3 py-2 font-semibold">{nf(r.totalWeight)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
