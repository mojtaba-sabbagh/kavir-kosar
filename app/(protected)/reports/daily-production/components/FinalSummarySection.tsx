import { prisma } from "@/lib/db";
import type { ProductKey } from "@/lib/report-helpers";

type Props = { date: string; product?: ProductKey };

/* ------------------ tiny utils ------------------ */
function pick<T = any>(o: any, paths: string[], def?: any): T | undefined {
  for (const p of paths) {
    const val = p.split(".").reduce((acc: any, k) => (acc ? acc[k] : undefined), o);
    if (val !== undefined && val !== null && val !== "") return val as T;
  }
  return def;
}
function num(x: any): number { const n = Number(x); return Number.isFinite(n) ? n : 0; }
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
function faToEnDigits(s: any): string {
  const str = String(s ?? "");
  const map: Record<string, string> = {
    "۰":"0","۱":"1","۲":"2","۳":"3","۴":"4","۵":"5","۶":"6","۷":"7","۸":"8","۹":"9",
    "٠":"0","١":"1","٢":"2","٣":"3","٤":"4","٥":"5","٦":"6","٧":"7","٨":"8","٩":"9",
  };
  return str.replace(/[0-9۰-۹٠-٩]/g, ch => map[ch] ?? ch);
}
function cleanCode(input: any): string {
  const s = faToEnDigits(String(input ?? ""));
  return s.replace(/[^\d]/g, "");
}
function matchPattern(code: string, pattern: string): boolean {
  const re = new RegExp("^" + pattern.replace(/\*/g, "\\d") + "$");
  return re.test(code);
}
// English-number formatter
const nf = (n: number, frac = 3) =>
  n.toLocaleString("en-US", { maximumFractionDigits: frac, minimumFractionDigits: 0 });

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
    select: { code: true, nameFa: true },
  });
  const m = new Map<string, string>();
  for (const it of items) m.set(it.code, String(it.nameFa ?? it.code));
  return m;
}

/* --------------------------------- Component ---------------------------------- */
export default async function FinalSummarySection({ date, product }: Props) {
  const prod: ProductKey = product === "2" ? "2" : "1";
  const productLabel = prod === "2" ? "پاپکورن" : "چیپس";

  // 1031100 (raws), 1020600 (remain), 1031000 (product weight)
  const idsMap = await getFormIdsByCodes(["1031100", "1020600", "1031000"]);
  const rawsFormId    = idsMap.get("1031100") ?? "";
  const remainFormId  = idsMap.get("1020600") ?? "";
  const productFormId = idsMap.get("1031000") ?? "";

  const [raws, remains, products] = await Promise.all([
    getEntriesByDate(rawsFormId ? [rawsFormId] : [], date),
    getEntriesByDate(remainFormId ? [remainFormId] : [], date),
    getEntriesByDate(productFormId ? [productFormId] : [], date),
  ]);

  // --- totals (product-aware) ---
  let cornConsumedKg = 0;            // chips: 1101000001 | popcorn: startsWith 112
  let spicesConsumedKgTotal = 0;     // 13***1**** or 13***2****
  let oilConsumedCans = 0;           // startsWith 1204
  let limeConsumedKg = 0;            // from RAW MATERIALS (prefix 1522)
  const spicesByCode = new Map<string, number>();

  for (const e of raws) {
    const v = (e.payload ?? {}) as any;
    const code = cleanCode(codeFromAny(v.raw_material ?? v.rawMaterial ?? v.material ?? v.code));
    const amt = amountOf(v);
    if (!code || !amt) continue;

    // Corn
    if (prod === "1") {
      if (code === "1101000001") cornConsumedKg += amt;
    } else {
      if (code.startsWith("112")) cornConsumedKg += amt;
    }

    // Spices by product
    if (prod === "1") {
      if (matchPattern(code, "13***1****")) {
        spicesConsumedKgTotal += amt;
        spicesByCode.set(code, (spicesByCode.get(code) ?? 0) + amt);
      }
    } else {
      if (matchPattern(code, "13***2****")) {
        spicesConsumedKgTotal += amt;
        spicesByCode.set(code, (spicesByCode.get(code) ?? 0) + amt);
      }
    }

    // Oil
    if (code.startsWith("1204")) oilConsumedCans += amt;

    // Lime
    if (code.startsWith("1522")) limeConsumedKg += amt;
  }

  // remained corn from 1020600
  let remainedCornKg = 0;
  for (const e of remains) {
    const v = (e.payload ?? {}) as any;
    remainedCornKg += num(
      pick(v, ["remaining_corn", "remainingCorn", "corn_remaining", "remained_corn"], 0)
    );
  }

  // product weight from 1031000: chips → 41*, popcorn → 42*
  const prodPrefix = prod === "2" ? "42" : "41";
  let productWeightKg = 0;
  for (const e of products) {
    const v = (e.payload ?? {}) as any;
    const code = cleanCode(codeFromAny(v.raw_material ?? v.rawMaterial ?? v.material ?? v.code));
    const amt = amountOf(v);
    if (!code || !amt) continue;
    if (code.startsWith(prodPrefix)) productWeightKg += amt;
  }

  // percentages (keep English digits)
  const productPct = cornConsumedKg > 0 ? (productWeightKg / cornConsumedKg) * 100 : 0;
  const oilPct = productWeightKg > 0 ? (oilConsumedCans / productWeightKg) * 100 : 0;

  // spice breakdown
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

  return (
    <div className="rounded-lg border border-gray-200 bg-white  font-semibold">
      <div className="border-b border-gray-200 px-4 py-3 font-semibold text-gray-900">
        جمع بندی – {productLabel}
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
              <td className="px-3 py-2">روغن مصرفی (حلب)</td>
              <td className="px-3 py-2 text-left">{nf(oilConsumedCans)}</td>
            </tr>
            <tr>
              <td className="px-3 py-2">وزن محصول (کیلوگرم)</td>
              <td className="px-3 py-2 text-left">{nf(productWeightKg)}</td>
            </tr>
            <tr>
              <td className="px-3 py-2">درصد محصول</td>
              <td className="px-3 py-2 text-left">{cornConsumedKg > 0 ? `${productPct.toFixed(2)}%` : "—"}</td>
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
                    <td className="px-3 py-2 text-left">{nf(s.kg)}</td>
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
