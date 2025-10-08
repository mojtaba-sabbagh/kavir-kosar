// app/(protected)/reports/daily-production/components/FinalSummarySection.tsx
import { prisma } from "@/lib/db";

type Props = { date: string; product?: string | number };

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
  return num(pick(v, ["amount", "qty", "مقدار", "تعداد"], 0));
}
function onlyDigits(s: any): string {
  return String(s ?? "").replace(/[^\d]/g, "");
}
function codeFromAny(v: any): string {
  if (v == null) return "";
  if (typeof v === "object") {
    const raw = v.code ?? v.value ?? v.id ?? v.key ?? v.kardexCode ?? v.itemCode;
    return raw ? onlyDigits(raw) : "";
  }
  return onlyDigits(v);
}
function patternToRegex(p: string) {
  return new RegExp("^" + p.replace(/\*/g, "\\d") + "$");
}

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

/* ------------------ optional names for spice codes from Kardex ------------------ */
async function fetchKardexNames(codes: string[]) {
  if (!codes.length) return new Map<string, string>();
  const items = await prisma.kardexItem.findMany({
    where: { code: { in: Array.from(new Set(codes)) } },
    select: { code: true, nameFa: true, name: true },
  });
  const m = new Map<string, string>();
  for (const it of items) {
    m.set(it.code, String(it.nameFa ?? it.name ?? it.code));
  }
  return m;
}

/* ------------------ product-aware matchers ------------------ */
function normalizeProduct(p?: string | number): "1" | "2" {
  const s = String(p ?? "1").trim();
  return s === "2" ? "2" : "1";
}
function isRowForProduct(payload: any, product: "1" | "2"): boolean {
  const pv = pick<any>(payload, ["product", "payload.product"]);
  if (pv === undefined || pv === null || pv === "") return true; // untagged -> include
  return String(pv) === product;
}

// Corn
function isCorn(code: string, product: "1" | "2"): boolean {
  return product === "1" ? code === "1101000001" : code.startsWith("112");
}

// Spices
const SPICE_PATTERNS = {
  "1": [patternToRegex("13***1****")],
  "2": [patternToRegex("13***2****")],
} as const;
function isSpice(code: string, product: "1" | "2"): boolean {
  return SPICE_PATTERNS[product].some((re) => re.test(code));
}

// Oil
function isOil(code: string): boolean {
  return code.startsWith("1204");
}

// Product weight (from 1031007)
function isProductWeight(code: string, product: "1" | "2"): boolean {
  return product === "1" ? code.startsWith("41") : code.startsWith("42");
}

// Lime (from 1031007)
function isLime(code: string): boolean {
  return code === "1522000001" || code.startsWith("1522000001");
}

/* --------------------------------- Component ---------------------------------- */
export default async function FinalSummarySection({ date, product }: Props) {
  const prod = normalizeProduct(product); // <- robust normalization
  const idsMap = await getFormIdsByCodes(["1031100", "1020600", "1031007"]);
  const rawsFormId = idsMap.get("1031100") ?? "";
  const remainFormId = idsMap.get("1020600") ?? "";
  const productFormId = idsMap.get("1031007") ?? "";

  const [raws, remains, products] = await Promise.all([
    getEntriesByDate(rawsFormId ? [rawsFormId] : [], date),
    getEntriesByDate(remainFormId ? [remainFormId] : [], date),
    getEntriesByDate(productFormId ? [productFormId] : [], date),
  ]);

  // --- totals (filtered by product when payload.product exists) ---
  let cornConsumedKg = 0;
  let spicesConsumedKgTotal = 0;
  let oilConsumedCans = 0;
  const spicesByCode = new Map<string, number>();

  for (const e of raws) {
    const v = (e.payload ?? {}) as any;
    if (!isRowForProduct(v, prod)) continue;

    const code = codeFromAny(v.raw_material ?? v.rawMaterial ?? v.material ?? v.code);
    const amt = amountOf(v);
    if (!code || !amt) continue;

    if (isCorn(code, prod)) cornConsumedKg += amt;
    if (isSpice(code, prod)) {
      spicesConsumedKgTotal += amt;
      spicesByCode.set(code, (spicesByCode.get(code) ?? 0) + amt);
    }
    if (isOil(code)) oilConsumedCans += amt;
  }

  // remained corn from 1020600: payload.remaining_corn
  let remainedCornKg = 0;
  for (const e of remains) {
    const v = (e.payload ?? {}) as any;
    if (!isRowForProduct(v, prod)) continue;
    remainedCornKg += num(
      pick(v, ["remaining_corn", "remainingCorn", "corn_remaining", "remained_corn"], 0)
    );
  }

  // product weight & lime from 1031007 (product-aware)
  let productWeightKg = 0;
  let limeConsumedKg = 0;
  for (const e of products) {
    const v = (e.payload ?? {}) as any;
    if (!isRowForProduct(v, prod)) continue;

    const code = codeFromAny(v.raw_material ?? v.rawMaterial ?? v.material ?? v.code);
    const amt = amountOf(v);
    if (!code || !amt) continue;

    if (isProductWeight(code, prod)) productWeightKg += amt;
    if (isLime(code)) limeConsumedKg += amt;
  }

  // percentages
  const productPct = cornConsumedKg > 0 ? (productWeightKg / cornConsumedKg) * 100 : 0;
  const oilPct = productWeightKg > 0 ? (oilConsumedCans / productWeightKg) * 100 : 0;

  // spice lines (label -> kg + % of product)
  const spiceCodes = Array.from(spicesByCode.keys());
  const kardexNames = await fetchKardexNames(spiceCodes);

  const spiceRows = spiceCodes
    .map((code) => {
      const kg = spicesByCode.get(code) ?? 0;
      const pct = productWeightKg > 0 ? (kg / productWeightKg) * 100 : 0;
      const label = kardexNames.get(code) ?? code;
      return { code, label, kg, pct };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "fa"));

  const productLabel = prod === "1" ? "چیپس" : "پاپکورن";

  // render
  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-4 py-3 font-semibold text-gray-900">
        جمع بندی – {productLabel}
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
              <td className="px-3 py-2 text-left">{cornConsumedKg.toLocaleString("fa-IR")}</td>
            </tr>
            <tr>
              <td className="px-3 py-2">ذرت باقیمانده (کیلوگرم)</td>
              <td className="px-3 py-2 text-left">{remainedCornKg.toLocaleString("fa-IR")}</td>
            </tr>
            <tr>
              <td className="px-3 py-2">ادویه مصرفی (کیلوگرم)</td>
              <td className="px-3 py-2 text-left">{spicesConsumedKgTotal.toLocaleString("fa-IR")}</td>
            </tr>
            <tr>
              <td className="px-3 py-2">روغن مصرفی (حلب)</td>
              <td className="px-3 py-2 text-left">{oilConsumedCans.toLocaleString("fa-IR")}</td>
            </tr>
            <tr>
              <td className="px-3 py-2">وزن محصول (کیلوگرم)</td>
              <td className="px-3 py-2 text-left">{productWeightKg.toLocaleString("fa-IR")}</td>
            </tr>
            <tr>
              <td className="px-3 py-2">درصد محصول</td>
              <td className="px-3 py-2 text-left">
                {cornConsumedKg > 0 ? `${productPct.toFixed(2)}٪` : "—"}
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2">درصد روغن</td>
              <td className="px-3 py-2 text-left">
                {productWeightKg > 0 ? `${oilPct.toFixed(2)}٪` : "—"}
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2">آهک مصرفی (کیلوگرم)</td>
              <td className="px-3 py-2 text-left">{limeConsumedKg.toLocaleString("fa-IR")}</td>
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
                    <td className="px-3 py-2 text-left">{s.kg.toLocaleString("fa-IR")}</td>
                    <td className="px-3 py-2 text-left">
                      {productWeightKg > 0 ? `${s.pct.toFixed(2)}٪` : "—"}
                    </td>
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
