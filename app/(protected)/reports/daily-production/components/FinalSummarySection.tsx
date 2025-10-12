// app/(protected)/reports/daily-production/components/FinalSummarySection.tsx
import { prisma } from "@/lib/db";

type ProductKey = "1" | "2";
type Props = { date: string; product: ProductKey };

/* ------------------ tiny utils ------------------ */
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
    const raw = v.code ?? v.value ?? v.id ?? v.key ?? v.kardexCode ?? v.itemCode ?? v.name;
    return raw ? String(raw) : "";
  }
  return String(v);
}
const nfEn = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: 3, minimumFractionDigits: 0 });

/* ----------- map form codes -> formIds, fetch entries by payload.date ----------- */
async function getFormIdsByCodes(codes: string[]) {
  const forms = await prisma.form.findMany({
    where: { code: { in: codes } },
    select: { id: true, code: true },
  });
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

/* ---------------- product-aware family helpers ---------------- */
function isCorn(code: string, product: ProductKey) {
  // chips: 110…, popcorn: 112…
  return product === "1" ? code.startsWith("110") : code.startsWith("112");
}
function isOil(code: string) {
  return code.startsWith("1204");
}
/** spice: 13***{product}****  (6th digit = product) */
function isSpiceFamily13(code: string, product: ProductKey) {
  return code.startsWith("13") && code.length >= 6 && code[5] === product;
}
/** additional spice: 32***{product}****  (6th digit = product) */
function isSpiceFamily32(code: string, product: ProductKey) {
  return code.startsWith("32") && code.length >= 6 && code[5] === product;
}
function isSpice(code: string, product: ProductKey) {
  return isSpiceFamily13(code, product) || isSpiceFamily32(code, product);
}
/** product lines: chips→41…, popcorn→42… */
function isProductCode(code: string, product: ProductKey) {
  return product === "1" ? code.startsWith("41") : code.startsWith("42");
}

/* ------------------ optional names/weights from Kardex ------------------ */
async function fetchKardexExtras(codes: string[]) {
  if (!codes.length) return new Map<string, { nameFa?: string | null; weight?: number }>();
  const items = await prisma.kardexItem.findMany({
    where: { code: { in: Array.from(new Set(codes)) } },
    select: { code: true, nameFa: true, extra: true },
  });
  const m = new Map<string, { nameFa?: string | null; weight?: number }>();
  for (const it of items) {
    const w = Number((it as any)?.extra?.weight);
    m.set(it.code, {
      nameFa: it.nameFa ?? null,
      weight: Number.isFinite(w) ? w : undefined,
    });
  }
  return m;
}

/* --------------------------------- Component ---------------------------------- */
export default async function FinalSummarySection({ date, product }: Props) {
  // Form ids
  const idsMap = await getFormIdsByCodes(["1031100", "1031000", "1020600"]);
  const rawsFormId    = idsMap.get("1031100") ?? ""; // positives (consumption)
  const ioFormId      = idsMap.get("1031000") ?? ""; // BOTH returns (source=1) and products
  const remainFormId  = idsMap.get("1020600") ?? "";

  // Fetch entries
  const [raws, io, remains] = await Promise.all([
    getEntriesByDate(rawsFormId ? [rawsFormId] : [], date),
    getEntriesByDate(ioFormId ? [ioFormId] : [], date),
    getEntriesByDate(remainFormId ? [remainFormId] : [], date),
  ]);

  /* ---------------- RAW MATERIALS (with product filter) ---------------- */
  let cornConsumedKg = 0;
  let oilCans = 0;
  let spicesConsumedKgTotal = 0;
  const spicesByCode = new Map<string, number>();

  // + from 1031100
  for (const e of raws) {
    const v = (e.payload ?? {}) as any;
    const pval = String(pick(v, ["product", "payload.product"], "")) || "";
    if (pval !== product) continue;

    const code = codeFromAny(v.raw_material ?? v.rawMaterial ?? v.material ?? v.code);
    const amt = amountOf(v);
    if (!code || !amt) continue;

    if (isCorn(code, product)) cornConsumedKg += amt;
    else if (isOil(code)) oilCans += amt;
    else if (isSpice(code, product)) {
      spicesConsumedKgTotal += amt;
      spicesByCode.set(code, (spicesByCode.get(code) ?? 0) + amt);
    }
  }

  // − returns from 1031000 where source == 1 (still filter by product)
  for (const e of io) {
    const v = (e.payload ?? {}) as any;
    const src = String(pick(v, ["source", "payload.source"], "")) || "";
    if (src !== "1") continue; // only returns
    const pval = String(pick(v, ["product", "payload.product"], "")) || "";
    if (pval !== product) continue;

    const code = codeFromAny(v.raw_material ?? v.rawMaterial ?? v.material ?? v.code);
    const amt = amountOf(v);
    if (!code || !amt) continue;

    if (isCorn(code, product)) cornConsumedKg -= amt;
    else if (isOil(code)) oilCans -= amt;
    else if (isSpice(code, product)) {
      spicesConsumedKgTotal -= amt;
      spicesByCode.set(code, (spicesByCode.get(code) ?? 0) - amt);
    }
  }

  // remained corn
  let remainedCornKg = 0;
  for (const e of remains) {
    const v = (e.payload ?? {}) as any;
    remainedCornKg += num(
      pick(v, ["remaining_corn", "remainingCorn", "corn_remaining", "remained_corn"], 0)
    );
  }

  /* ---------------- PRODUCTS (from 1031000 ONLY; no product filter) ---------------- */
  // For selected product, include only the corresponding product-code family (41/42)
  const productCodes: string[] = [];
  let productWeightKg = 0;

  for (const e of io) {
    const v = (e.payload ?? {}) as any;
    const code = codeFromAny(v.raw_material ?? v.rawMaterial ?? v.material ?? v.code);
    const amt = amountOf(v);
    if (!code || !amt) continue;

    if (isProductCode(code, product)) {
      productCodes.push(code);
    }
  }

  // get per-unit weights for product codes (fallback 1)
  const prodExtras = await fetchKardexExtras(productCodes);
  for (const e of io) {
    const v = (e.payload ?? {}) as any;
    const code = codeFromAny(v.raw_material ?? v.rawMaterial ?? v.material ?? v.code);
    const amt = amountOf(v);
    if (!code || !amt) continue;

    if (isProductCode(code, product)) {
      const w = prodExtras.get(code)?.weight ?? 1;
      productWeightKg += amt * w;
    }
  }

  /* ---------------- oil kg (convert cans -> kg) ---------------- */
  // Fetch oil can weights (1204…) and convert to kg
  const oilCodes = ["1204"]; // we’ll match by startsWith when applying map
  const oilExtras = await fetchKardexExtras(oilCodes);
  // If there are multiple 1204 SKUs, you can expand to collect exact codes above.
  const perCanWeight = (() => {
    // try to find a 1204* code weight if present
    for (const [code, ex] of oilExtras) {
      if (code.startsWith("1204") && ex?.weight) return ex.weight!;
    }
    return 1; // fallback
  })();
  const oilKg = oilCans * perCanWeight;

  /* ---------------- lime default (1% of corn weight) ---------------- */
  const limeConsumedKg = cornConsumedKg > 0 ? cornConsumedKg * 0.01 : 0;

  /* ---------------- percentages ---------------- */
  const productPct = cornConsumedKg > 0 ? (productWeightKg / cornConsumedKg) * 100 : 0;
  const oilPct = productWeightKg > 0 ? (oilKg / productWeightKg) * 100 : 0;

  /* ---------------- per-spice breakdown (names optional) ---------------- */
  const spiceCodes = Array.from(spicesByCode.keys()).filter((c) => (spicesByCode.get(c) ?? 0) !== 0);
  const spiceExtras = await fetchKardexExtras(spiceCodes);
  const spiceRows = spiceCodes
    .map((code) => {
      const kg = spicesByCode.get(code) ?? 0;
      const pct = productWeightKg > 0 ? (kg / productWeightKg) * 100 : 0;
      const label = spiceExtras.get(code)?.nameFa ?? code;
      return { code, label, kg, pct };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "fa"));

  const productLabel = product === "1" ? "چیپس" : "پاپکورن";

  // render
  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-4 py-3 font-semibold text-gray-900">
        {`جمع بندی – ${productLabel}`}
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
              <td className="px-3 py-2 text-left">{nfEn(cornConsumedKg)}</td>
            </tr>
            <tr>
              <td className="px-3 py-2">ذرت باقیمانده (کیلوگرم)</td>
              <td className="px-3 py-2 text-left">{nfEn(remainedCornKg)}</td>
            </tr>
            <tr>
              <td className="px-3 py-2">ادویه مصرفی (کیلوگرم)</td>
              <td className="px-3 py-2 text-left">{nfEn(spicesConsumedKgTotal)}</td>
            </tr>
            <tr>
              <td className="px-3 py-2">روغن مصرفی (کیلوگرم)</td>
              <td className="px-3 py-2 text-left">{nfEn(oilKg)}</td>
            </tr>
            <tr>
              <td className="px-3 py-2">وزن محصول (کیلوگرم)</td>
              <td className="px-3 py-2 text-left">{nfEn(productWeightKg)}</td>
            </tr>
            <tr>
              <td className="px-3 py-2">درصد محصول</td>
              <td className="px-3 py-2 text-left">{cornConsumedKg > 0 ? `${productPct.toFixed(2)}` : "—"}</td>
            </tr>
            <tr>
              <td className="px-3 py-2">درصد روغن</td>
              <td className="px-3 py-2 text-left">{productWeightKg > 0 ? `${oilPct.toFixed(2)}` : "—"}</td>
            </tr>
            <tr>
              <td className="px-3 py-2">آهک مصرفی (کیلوگرم)</td>
              <td className="px-3 py-2 text-left">{nfEn(limeConsumedKg)}</td>
            </tr>
          </tbody>
        </table>

        {/* Per-spice breakdown */}
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
                <tr>
                  <td colSpan={3} className="px-3 py-3 text-center text-gray-500">داده‌ای ثبت نشده است</td>
                </tr>
              ) : (
                spiceRows.map((s) => (
                  <tr key={s.code}>
                    <td className="px-3 py-2">{s.label}</td>
                    <td className="px-3 py-2 text-left">{nfEn(s.kg)}</td>
                    <td className="px-3 py-2 text-left">{productWeightKg > 0 ? `${s.pct.toFixed(2)}` : "—"}</td>
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
