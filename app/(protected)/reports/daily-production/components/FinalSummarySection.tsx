import { prisma } from "@/lib/db";

type ProductKey = "1" | "2";
type Props = { date: string; product: ProductKey };

/* utils */
function pick<T = any>(o: any, paths: string[], def?: any): T | undefined {
  for (const p of paths) {
    const v = p.split(".").reduce((acc: any, k) => (acc ? acc[k] : undefined), o);
    if (v !== undefined && v !== null && v !== "") return v as T;
  }
  return def;
}
function num(x: any) { const n = Number(x); return Number.isFinite(n) ? n : 0; }
function amountOf(v: any): number {
  return num(pick(v, ["amount", "qty", "quantity", "count", "value", "مقدار", "تعداد"], 0));
}
function codeFromAny(v: any): string {
  if (v == null) return "";
  if (typeof v === "object") {
    const raw = v.code ?? v.value ?? v.id ?? v.key ?? v.kardexCode ?? v.itemCode ?? v.name;
    return raw ? String(raw) : "";
  }
  return String(v);
}
const en = (n: number, frac = 3) =>
  n.toLocaleString("en-US", { maximumFractionDigits: frac, minimumFractionDigits: 0 });

/* forms */
async function getFormIdsByCodes(codes: string[]) {
  const forms = await prisma.form.findMany({
    where: { code: { in: codes } },
    select: { id: true, code: true },
  });
  return new Map(forms.map((f) => [f.code, f.id]));
}

/* where: by date (+ optional product on payload) */
function productWhereClause(product?: ProductKey) {
  if (!product) return undefined;
  const asNum = Number(product);
  return {
    OR: [
      { payload: { path: ["product"], equals: product } },
      { payload: { path: ["product"], equals: asNum } },
      { payload: { path: ["line"],    equals: product } }, // legacy
      { payload: { path: ["line"],    equals: asNum } },
    ],
  };
}

async function getEntriesByDate(formIds: string[], date: string, product?: ProductKey) {
  if (!formIds.length) return [];
  const prod = productWhereClause(product);
  return prisma.formEntry.findMany({
    where: {
      formId: { in: formIds },
      AND: [
        {
          OR: [
            { payload: { path: ["date"], equals: date } },
            { payload: { path: ["payloadDate"], equals: date } },
            { payload: { path: ["tarikh"], equals: date } },
            { payload: { path: ["payload", "date"], equals: date } },
          ],
        },
        ...(prod ? [prod] : []),
      ],
    },
    select: { id: true, payload: true, formId: true },
    orderBy: { id: "asc" },
  });
}

/* kardex helpers */
async function fetchKardexWeights(codes: string[]) {
  if (!codes.length) return new Map<string, number>();
  const items = await prisma.kardexItem.findMany({
    where: { code: { in: Array.from(new Set(codes)) } },
    select: { code: true, extra: true },
  });
  const m = new Map<string, number>();
  for (const it of items) {
    const w = Number((it as any)?.extra?.weight);
    // store only valid weights; defaulting happens at usage time
    if (Number.isFinite(w) && w > 0) m.set(it.code, w);
  }
  return m;
}
async function fetchKardexNames(codes: string[]) {
  if (!codes.length) return new Map<string, string>();
  const items = await prisma.kardexItem.findMany({
    where: { code: { in: Array.from(new Set(codes)) } },
    select: { code: true, nameFa: true },
  });
  const m = new Map<string, string>();
  for (const it of items) m.set(it.code, String(it.nameFa ?? it.code));
  return m;
}

/* spice helpers: 13xxx{p}xxxx OR 32xxx{p}xxxx */
function digits(s: any) { return String(s ?? "").replace(/\D+/g, ""); }
function isSpice13(code: string, p: ProductKey) { const c = digits(code); return c.startsWith("13") && c.length >= 6 && c[5] === p; }
function isSpice32(code: string, p: ProductKey) { const c = digits(code); return c.startsWith("32") && c.length >= 6 && c[5] === p; }
function isSpiceByProduct(code: string, p: ProductKey) { return isSpice13(code, p) || isSpice32(code, p); }

/* belongs to product (for 1031000) via code family */
function belongsToProductByCode(code: string, p: ProductKey) {
  const c = digits(code);
  return p === "1" ? c.startsWith("41") : c.startsWith("42");
}

export default async function FinalSummarySection({ date, product }: Props) {
  const ids = await getFormIdsByCodes(["1031100", "1020600", "1031000"]);
  const rawsFormId    = ids.get("1031100") ?? "";
  const remainFormId  = ids.get("1020600") ?? "";
  const productFormId = ids.get("1031000") ?? "";

  // RAW MATERIALS (1031100): filter by payload.product (ONLY here)
  const raws    = await getEntriesByDate(rawsFormId ? [rawsFormId] : [], date, product);
  // REMAINS (1020600): not product-scoped
  const remains = await getEntriesByDate(remainFormId ? [remainFormId] : [], date, undefined);
  // PRODUCTS (1031000): DO NOT filter by payload.product; we’ll filter by code family (41/42) later
  const products = await getEntriesByDate(productFormId ? [productFormId] : [], date, undefined);

  /* ---- aggregate raws ---- */
  let cornConsumedKg = 0;               // 1101000001
  let oilCansByCode = new Map<string, number>(); // 1204*
  let spicesByCode  = new Map<string, number>(); // 13/32 family per product
  let limeConsumedKg = 0;               // 1522000001

  for (const e of raws) {
    const v = (e.payload ?? {}) as any;
    const code = codeFromAny(v.raw_material ?? v.rawMaterial ?? v.material ?? v.code);
    const amt = amountOf(v);
    if (!code || !amt) continue;

    if (code === "1101000001") cornConsumedKg += amt;
    if (code.startsWith("1204")) {
      oilCansByCode.set(code, (oilCansByCode.get(code) ?? 0) + amt);
    }
    if (isSpiceByProduct(code, product)) {
      spicesByCode.set(code, (spicesByCode.get(code) ?? 0) + amt);
    }
    if (code === "1522000001" || code.startsWith("1522000001")) {
      limeConsumedKg += amt;
    }
  }

  /* ---- aggregate products (1031000) by code → then weight with kardex.extra.weight (default 1) ---- */
  const prodAmtByCode = new Map<string, number>();
  for (const e of products) {
    const v = (e.payload ?? {}) as any;
    const code = codeFromAny(v.raw_material ?? v.rawMaterial ?? v.material ?? v.code);
    const amt = amountOf(v);
    if (!code || !amt) continue;
    if (!belongsToProductByCode(code, product)) continue; // 41* for chips, 42* for popcorn
    prodAmtByCode.set(code, (prodAmtByCode.get(code) ?? 0) + amt);
  }

  const prodCodes = Array.from(prodAmtByCode.keys());
  const oilCodes  = Array.from(oilCansByCode.keys());
  const kdWeights = await fetchKardexWeights([...prodCodes, ...oilCodes]);

  // DEFAULT weight = 1 when kardex.extra.weight is missing/invalid
  let productWeightKg = 0;
  for (const [code, amt] of prodAmtByCode) {
    const perUnit = kdWeights.get(code) ?? 1;   // ← default 1
    productWeightKg += amt * perUnit;
  }

  let oilKg = 0;
  for (const [code, cans] of oilCansByCode) {
    const perCanKg = kdWeights.get(code) ?? 1;  // ← default 1
    oilKg += cans * perCanKg;
  }

  // remains: sum remaining corn
  const remainedCornKg = remains.reduce(
    (s, e) => s + num(pick(e.payload ?? {}, ["remaining_corn", "remainingCorn", "corn_remaining", "remained_corn"], 0)),
    0
  );

  // spice breakdown (% of product)
  const spiceCodes = Array.from(spicesByCode.keys());
  const spiceNames = await fetchKardexNames(spiceCodes);
  const spiceRows = spiceCodes
    .map(code => {
      const kg = spicesByCode.get(code) ?? 0;
      const pct = productWeightKg > 0 ? (kg / productWeightKg) * 100 : 0;
      const label = spiceNames.get(code) ?? code;
      return { code, label, kg, pct };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "fa"));

  // percentages
  const productPct = cornConsumedKg > 0 ? (productWeightKg / cornConsumedKg) * 100 : 0;
  const oilPct     = productWeightKg > 0 ? (oilKg / productWeightKg) * 100 : 0;

  const titleSuffix = product === "2" ? "پاپکورن" : "چیپس";

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-4 py-3 font-semibold text-gray-900">
        جمع بندی – {titleSuffix}
      </div>

      <div className="p-4 space-y-6">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-white">
            <tr>
              <th className="px-3 py-2 text-right text-sm font-medium text-gray-900">شرح</th>
              <th className="px-3 py-2 text-left text-sm font-medium text-gray-900">مقدار</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            <tr><td className="px-3 py-2">ذرت مصرفی (کیلوگرم)</td><td className="px-3 py-2 text-left">{en(cornConsumedKg)}</td></tr>
            <tr><td className="px-3 py-2">ذرت باقیمانده (کیلوگرم)</td><td className="px-3 py-2 text-left">{en(remainedCornKg)}</td></tr>
            <tr><td className="px-3 py-2">ادویه مصرفی (کیلوگرم)</td><td className="px-3 py-2 text-left">{en(Array.from(spicesByCode.values()).reduce((s, v) => s + v, 0))}</td></tr>
            <tr><td className="px-3 py-2">روغن مصرفی (کیلوگرم)</td><td className="px-3 py-2 text-left">{en(oilKg)}</td></tr>
            <tr><td className="px-3 py-2">وزن محصول (کیلوگرم)</td><td className="px-3 py-2 text-left">{en(productWeightKg)}</td></tr>
            <tr><td className="px-3 py-2">درصد محصول</td><td className="px-3 py-2 text-left">{cornConsumedKg > 0 ? `${productPct.toFixed(2)}%` : "—"}</td></tr>
            <tr><td className="px-3 py-2">درصد روغن</td><td className="px-3 py-2 text-left">{productWeightKg > 0 ? `${oilPct.toFixed(2)}%` : "—"}</td></tr>
            <tr><td className="px-3 py-2">آهک مصرفی (کیلوگرم)</td><td className="px-3 py-2 text-left">{en(limeConsumedKg)}</td></tr>
          </tbody>
        </table>

        <div>
          <div className="mb-2 font-medium text-gray-900">سهم ادویه‌ها از وزن محصول</div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-white">
              <tr>
                <th className="px-3 py-2 text-right text-sm font-medium text-gray-900">ادویه</th>
                <th className="px-3 py-2 text-left text-sm font-medium text-gray-900">مصرف (کیلوگرم)</th>
                <th className="px-3 py-2 text-left text-sm font-medium text-gray-900">% نسبت به وزن محصول</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {spiceRows.length === 0 ? (
                <tr><td colSpan={3} className="px-3 py-3 text-center text-gray-500">داده‌ای ثبت نشده است</td></tr>
              ) : (
                spiceRows.map((s) => (
                  <tr key={s.code}>
                    <td className="px-3 py-2">{s.label}</td>
                    <td className="px-3 py-2 text-left">{en(s.kg)}</td>
                    <td className="px-3 py-2 text-left">{productWeightKg > 0 ? `${s.pct.toFixed(2)}%` : "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
