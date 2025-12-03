// app/(protected)/reports/daily-production/components/FinalSummarySection.tsx
import { prisma } from "@/lib/db";

type ProductKey = "1" | "2";
type Props = { date: string; product: ProductKey };

/* ---------------- utils ---------------- */
function pick<T = any>(o: any, paths: string[], def?: any): T | undefined {
  for (const p of paths) {
    const val = p.split(".").reduce((acc: any, k) => (acc ? acc[k] : undefined), o);
    if (val !== undefined && val !== null && val !== "") return val as T;
  }
  return def;
}
function num(x: any): number {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}
function amountOf(v: any): number {
  return num(pick(v, ["amount", "qty", "quantity", "value", "count", "تعداد", "مقدار"], 0));
}
function codeFromAny(v: any): string {
  if (v == null) return "";
  if (typeof v === "object") {
    const raw = v.code ?? v.value ?? v.id ?? v.key ?? v.kardexCode ?? v.itemCode;
    return raw ? String(raw) : "";
  }
  return String(v);
}
const PRODUCT_LABEL: Record<ProductKey, string> = { "1": "چیپس", "2": "پاپکورن" };

/** 32xxx{product}xxxx — the 6th digit (index 5) encodes product 1/2 */
function isSpiceFamily32(code: string, product: ProductKey) {
  const c = (code || "").replace(/[^\d]/g, "");
  return c.startsWith("32") && c.length >= 6 && c[5] === product;
}
/** 13***{product}**** */
function isSpiceFamily13(code: string, product: ProductKey) {
  const c = (code || "").replace(/[^\d]/g, "");
  return c.startsWith("13") && c.length >= 6 && c[5] === product;
}

/* ----------- map form codes -> ids, fetch entries by payload.date ----------- */
async function getFormIdsByCodes(codes: string[]) {
  const forms = await prisma.form.findMany({ where: { code: { in: codes } }, select: { id: true, code: true } });
  return new Map(forms.map((f) => [f.code, f.id]));
}

async function getEntriesByDate(formIds: string[], date: string) {
  if (!formIds.length) return [];
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

/** kardex weights (per code); default 1 if not present */
async function fetchWeightsForCodes(codes: string[]): Promise<Map<string, number>> {
  if (!codes.length) return new Map();
  const items = await prisma.kardexItem.findMany({
    where: { code: { in: Array.from(new Set(codes)) } },
    select: { code: true, extra: true },
  });
  const m = new Map<string, number>();
  for (const it of items) {
    const w = Number((it as any)?.extra?.weight);
    m.set(it.code, Number.isFinite(w) && w > 0 ? w : 1);
  }
  return m;
}

/** fetch Persian names (nameFa) from kardex for codes */
async function fetchNamesForCodes(codes: string[]): Promise<Map<string, string>> {
  if (!codes.length) return new Map();
  const items = await prisma.kardexItem.findMany({
    where: { code: { in: Array.from(new Set(codes)) } },
    select: { code: true, nameFa: true },
  });
  const m = new Map<string, string>();
  for (const it of items) {
    m.set(it.code, it.nameFa);
  }
  return m;
}

export default async function FinalSummarySection({ date, product }: Props) {
  const ids = await getFormIdsByCodes(["1031100", "1031000", "1020600"]);
  const frmRaws = ids.get("1031100") ?? "";
  const frmReturns = ids.get("1031000") ?? ""; // used both for returns (source=1) and outputs (product weight)
  const frmRemain = ids.get("1020600") ?? "";

  const [rawsPlus, returnsAll, remains, outputs] = await Promise.all([
    // + raw consumptions (filter by product)
    getEntriesByDate(frmRaws ? [frmRaws] : [], date),
    // returns & all 1031000 rows (we'll split by source later)
    getEntriesByDate(frmReturns ? [frmReturns] : [], date),
    getEntriesByDate(frmRemain ? [frmRemain] : [], date),
    // same as returnsAll; we already fetched 1031000 above, avoid second roundtrip
    Promise.resolve([] as any[]),
  ]);
  // reuse 1031000 rows
  const rows1031000 = returnsAll;

  /* ---------------- raw materials (net) with product filter ---------------- */
  // plus (1031100, product filter)
  let cornPlus = 0;
  let oilPlusByCode = new Map<string, number>();
  let limePlus = 0;
  let spicesPlusByCode = new Map<string, number>();

  for (const e of rawsPlus) {
    const v = (e.payload ?? {}) as any;
    // enforce product on raws
    const pval = String(pick(v, ["product"], ""));
    if (pval !== product) continue;

    const code = codeFromAny(v.raw_material ?? v.rawMaterial ?? v.material ?? v.code);
    const amt = amountOf(v);
    if (!code || !amt) continue;

    if (code === "1101000001" || code.startsWith(product === "1" ? "110" : "112")) cornPlus += amt;
    if (code.startsWith("1204")) oilPlusByCode.set(code, (oilPlusByCode.get(code) ?? 0) + amt);
    if (code === "1522000001" || code.startsWith("1522")) limePlus += amt;

    if (isSpiceFamily13(code, product) || isSpiceFamily32(code, product)) {
      spicesPlusByCode.set(code, (spicesPlusByCode.get(code) ?? 0) + amt);
    }
  }

  // minus (1031000, source=1, product filter) — treat as returns
  let cornMinus = 0;
  let oilMinusByCode = new Map<string, number>();
  let limeMinus = 0;
  let spicesMinusByCode = new Map<string, number>();

  // - returns from 1031000 where source=1
for (const e of rows1031000) {
  const v = (e.payload ?? {}) as any;

  // must be a return
  const src = pick(v, ["source"], "");
  if (!(src === "1" || src === 1)) continue;

  // product filter: only apply if payload.product exists and differs
  const prodVal = pick(v, ["product"], undefined);
  if (prodVal != null && String(prodVal) !== product) continue;

  const code = codeFromAny(v.raw_material ?? v.rawMaterial ?? v.material ?? v.code);
  const amt  = amountOf(v);
  if (!code || !amt) continue;

  // subtract from raws
  if (code === "1101000001" || (product === "1" ? code.startsWith("110") : code.startsWith("112"))) {
    cornMinus += amt;
  }
  if (code.startsWith("1204")) {
    oilMinusByCode.set(code, (oilMinusByCode.get(code) ?? 0) + amt);
  }
  if (code === "1522000001" || code.startsWith("1522")) {
    limeMinus += amt;
  }
  if (isSpiceFamily13(code, product) || isSpiceFamily32(code, product)) {
    spicesMinusByCode.set(code, (spicesMinusByCode.get(code) ?? 0) + amt);
  }
}


  // net raws (apply minus)
  const cornConsumedKg = Math.max(0, cornPlus - cornMinus);
  const limeConsumedKgRaw = Math.max(0, limePlus - limeMinus);
  // net oil cans by code
  const allOilCodes = Array.from(new Set([...oilPlusByCode.keys(), ...oilMinusByCode.keys()]));
  const netOilCansByCode = new Map<string, number>();
  for (const c of allOilCodes) {
    netOilCansByCode.set(c, (oilPlusByCode.get(c) ?? 0) - (oilMinusByCode.get(c) ?? 0));
  }
  // net spices by code
  const allSpiceCodes = Array.from(new Set([...spicesPlusByCode.keys(), ...spicesMinusByCode.keys()]));
  const netSpicesByCode = new Map<string, number>();
  for (const c of allSpiceCodes) {
    netSpicesByCode.set(c, (spicesPlusByCode.get(c) ?? 0) - (spicesMinusByCode.get(c) ?? 0));
  }
  const spicesConsumedKgTotal = [...netSpicesByCode.values()].reduce((s, x) => s + (x || 0), 0);

  // remained corn from 1020600: payload.remaining_corn
  let remainedCornKg = 0;
  for (const e of remains) {
    const v = (e.payload ?? {}) as any;
    remainedCornKg += num(
      pick(v, ["remaining_corn", "remainingCorn", "corn_remaining", "remained_corn"], 0)
    );
  }

  /* ---------------- product weight (outputs) — 1031000 only, NO product filter ---------------- */
  // Per your rule: chips => 41…, popcorn => 42…
  const productPrefix = product === "1" ? "41" : "42";
  const productItemsByCode = new Map<string, { count: number }>();
  const productCodes: string[] = [];

  for (const e of rows1031000) {
    const v = (e.payload ?? {}) as any;
    const code = codeFromAny(v.raw_material ?? v.rawMaterial ?? v.material ?? v.code);
    const amt = amountOf(v);
    if (!code || !amt) continue;
    if (code.startsWith(productPrefix)) {
      productItemsByCode.set(code, { count: (productItemsByCode.get(code)?.count ?? 0) + amt });
      productCodes.push(code);
    }
  }

  // fetch per-unit weights for output products + oil cans
  const weightCodes = Array.from(new Set([...productCodes, ...allOilCodes]));
  const weights = await fetchWeightsForCodes(weightCodes);

  // fetch Persian names for all spice codes
  const spiceCodesList = Array.from(netSpicesByCode.keys());
  const spiceNames = await fetchNamesForCodes(spiceCodesList);

  // product weight in kg
  let productWeightKg = 0;
  for (const [c, { count }] of productItemsByCode.entries()) {
    const w = weights.get(c) ?? 1; // default 1 if missing
    productWeightKg += count * w;
  }

  // oil in kg (convert each code by its own weight)
  let oilKg = 0;
  console.log(netOilCansByCode);
  for (const [c, cans] of netOilCansByCode.entries()) {
    const w = weights.get(c) ?? 1;
    oilKg += cans * w;
  }

  // lime: if none recorded, default to 1% of corn
  const limeConsumedKg = limeConsumedKgRaw > 0 ? limeConsumedKgRaw : cornConsumedKg * 0.01;

  /* ---------------- percentages ---------------- */
  const productPct = cornConsumedKg > 0 ? (productWeightKg / cornConsumedKg) * 100 : 0;
  const oilPct = productWeightKg > 0 ? (oilKg / productWeightKg) * 100 : 0;

  const nf = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 3 });

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-4 py-3 font-semibold text-gray-900">
        جمع بندی – {PRODUCT_LABEL[product]}
      </div>

      <div className="p-4 space-y-6">
        {/* Summary table */}
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-white">
            <tr>
              <th className="px-3 py-2 text-right text-sm font-medium text-gray-900">شرح</th>
              <th className="px-3 py-2 text-left text-sm font-medium text-gray-900">مقدار</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            <tr>
              <td className="px-3 py-2">ذرت مصرفی (کیلوگرم)</td>
              <td className="px-3 py-2 text-left">{nf(cornConsumedKg)}</td>
            </tr>
            <tr>
              <td className="px-3 py-2">ذرت باقیمانده (کیلوگرم)</td>
              <td className="px-3 py-2 text-left">{nf(remainedCornKg)}</td>
            </tr>
            <tr>
              <td className="px-3 py-2">ادویه مصرفی (کیلوگرم)</td>
              <td className="px-3 py-2 text-left">{nf(spicesConsumedKgTotal)}</td>
            </tr>
            <tr>
              <td className="px-3 py-2">روغن مصرفی (کیلوگرم)</td>
              <td className="px-3 py-2 text-left">{nf(oilKg)}</td>
            </tr>
            <tr>
              <td className="px-3 py-2">وزن محصول (کیلوگرم)</td>
              <td className="px-3 py-2 text-left">{nf(productWeightKg)}</td>
            </tr>
            <tr>
              <td className="px-3 py-2">درصد محصول</td>
              <td className="px-3 py-2 text-left">{productWeightKg > 0 && cornConsumedKg > 0 ? `${productPct.toFixed(2)}%` : "—"}</td>
            </tr>
            <tr>
              <td className="px-3 py-2">درصد روغن</td>
              <td className="px-3 py-2 text-left">{productWeightKg > 0 ? `${oilPct.toFixed(2)}%` : "—"}</td>
            </tr>
            <tr>
              <td className="px-3 py-2">آهک مصرفی (کیلوگرم)</td>
              <td className="px-3 py-2 text-left">{nf(limeConsumedKg)}</td>
            </tr>
          </tbody>
        </table>

        {/* Per-spice breakdown (kg and % of product) */}
        <div>
          <div className="mb-2 font-medium text-gray-900">سهم ادویه‌ها از وزن محصول</div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-white">
              <tr>
                <th className="px-3 py-2 text-right text-sm font-medium text-gray-900">ادویه (کد)</th>
                <th className="px-3 py-2 text-left text-sm font-medium text-gray-900">مصرف (کیلوگرم)</th>
                <th className="px-3 py-2 text-left text-sm font-medium text-gray-900">% نسبت به وزن محصول</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {Array.from(netSpicesByCode.entries()).length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-3 text-center text-gray-500">داده‌ای ثبت نشده است</td>
                </tr>
              ) : (
                Array.from(netSpicesByCode.entries())
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([code, kg]) => {
                    const pct = productWeightKg > 0 ? (kg / productWeightKg) * 100 : 0;
                    const nameFa = spiceNames.get(code) || code;
                    return (
                      <tr key={code}>
                        <td className="px-3 py-2">{nameFa} <span className="text-gray-500 text-sm" dir="ltr">({code})</span></td>
                        <td className="px-3 py-2 text-left">{nf(kg)}</td>
                        <td className="px-3 py-2 text-left">{productWeightKg > 0 ? `${pct.toFixed(2)}%` : "—"}</td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
