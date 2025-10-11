// app/(protected)/reports/daily-production/components/RawMaterialsDetailsSection.tsx
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Accept product from the page: "1" (chips) | "2" (popcorn)
type Props = { date: string; product: "1" | "2" };

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

/* -------------------- group definitions -------------------- */
type GroupKey = "corn" | "oil" | "lime" | "spice" | "selfon" | "box";

/** additional-spice matcher: 32xxx{product}xxxx  (10+ digits; index 5 is product) */
function isSpiceFamily32(code: string, product: "1" | "2") {
  // ensure we use only digits
  const c = cleanCode(code) ?? "";
  return c.startsWith("32") && c.length >= 6 && c[5] === product;
}

/** group matcher that depends on the chosen product (for 32… family) */
function matchGroupByCode(code: string | undefined, product: "1" | "2"): GroupKey | undefined {
  const s = cleanCode(code);
  if (!s) return;
  if (s.startsWith("11") || s.startsWith("112") || s.startsWith("110")) return "corn";
  if (s.startsWith("1204")) return "oil";
  if (s.startsWith("1522")) return "lime";
  // spices: regular 13… + additional family 32xxx{product}xxxx
  if (s.startsWith("13") || isSpiceFamily32(s, product)) return "spice";
  if (s.startsWith("22")) return "selfon";
  if (s.startsWith("21") || s.startsWith("2100")) return "box";
  return;
}

/* ----------- robust extractor: string | array | object-map + spice carriers ----------- */
type Item = { code?: string; qty: number };

function extractFromAny(raw: any, topAmt: number): Item[] {
  if (!raw) return [];
  if (typeof raw === "string" || typeof raw === "number") {
    const code = cleanCode(raw);
    return code ? [{ code, qty: topAmt }] : [];
  }
  if (Array.isArray(raw)) {
    const out: Item[] = [];
    for (const r of raw) {
      const rawCode =
        r?.code ?? r?.kardexCode ?? r?.itemCode ??
        r?.raw_material ?? r?.material ??
        r?.kardex?.code ?? r?.item?.code ??
        (typeof r?.name === "string" && /^\d/.test(faToEnDigits(r.name)) ? r.name : undefined);
      const code = cleanCode(rawCode);
      const qty  = parseAmount(r?.amount ?? r?.qty ?? r?.quantity ?? r?.count ?? r?.value ?? topAmt);
      if (code && Number.isFinite(qty) && qty !== 0) out.push({ code, qty });
    }
    return out;
  }
  if (raw && typeof raw === "object") {
    return Object.entries(raw)
      .map(([k, v]) => ({ code: cleanCode(k), qty: parseAmount(v) }))
      .filter((x) => x.code && Number.isFinite(x.qty) && x.qty !== 0);
  }
  return [];
}

function extractItemsFromPayload(p: any): Item[] {
  const topAmt = parseAmount(p?.amount ?? p?.qty ?? p?.quantity ?? p?.value ?? p?.count);

  const carriers = [
    p?.raw_material,
    p?.rawMaterials,
    p?.mavadAvalieh,
    p?.materials,
    p?.items,
    p?.details,
  ];
  // sometimes recorded separately
  const spiceCarriers = [p?.spice, p?.spices];

  const all: Item[] = [];
  for (const c of carriers) all.push(...extractFromAny(c, topAmt));
  for (const c of spiceCarriers) all.push(...extractFromAny(c, topAmt));

  // de-dup by code (sum)
  const byCode = new Map<string, number>();
  for (const it of all) {
    const c = it.code;
    if (!c) continue;
    byCode.set(c, (byCode.get(c) ?? 0) + it.qty);
  }
  return [...byCode.entries()].map(([code, qty]) => ({ code, qty }));
}

/* -------------------- types -------------------- */
type TxnRow = {
  dateFa: string;                  // Jalali of payload.date
  shift?: 1 | 2 | 3;
  unitCode?: string | null;        // payload.unit code
  unitName?: string | null;        // from FixedInformation.title
  code: string;                    // raw material code
  nameFa?: string | null;          // from KardexItem.nameFa
  amount: number;
  description?: string | null;
};

/* -------------------- component -------------------- */
export default async function RawMaterialsDetailsSection({ date, product }: Props) {
  // IMPORTANT: now filter by payload.product === selected product ("1" or "2")
  const entries = await prisma.formEntry.findMany({
    where: {
      form: { code: "1031100" },
      status: "finalConfirmed",
      AND: [
        { payload: { path: ["date"], equals: date } },
        { payload: { path: ["product"], equals: product } },
      ],
    },
    select: { id: true, payload: true, finalConfirmedAt: true, createdAt: true },
    orderBy: { finalConfirmedAt: "asc" },
  });

  // Prepare group buckets
  const groups = new Map<GroupKey, { labelFa: string; total: number; rows: TxnRow[] }>([
    ["corn",   { labelFa: "ذرت",   total: 0, rows: [] }],
    ["oil",    { labelFa: "روغن",  total: 0, rows: [] }],
    ["lime",   { labelFa: "آهک",   total: 0, rows: [] }],
    ["spice",  { labelFa: "ادویه", total: 0, rows: [] }],  // will include 13… and 32xxx{product}xxxx
    ["selfon", { labelFa: "سلفون", total: 0, rows: [] }],
    ["box",    { labelFa: "کارتن", total: 0, rows: [] }],
  ]);

  // Collect lookups
  const matCodes = new Set<string>();
  const unitCodes = new Set<string>();

  // Fill buckets
  for (const e of entries) {
    const p = (e.payload as any) ?? {};
    const payloadDate = normalizeIsoDateLike(p?.date) || date; // fallback to requested date
    const dateFa = toJalali(payloadDate);
    const shift = parseShift(p?.shift ?? p?.workShift ?? p?.shiftNo);
    const unitCode = p?.unit ?? null;
    if (unitCode) unitCodes.add(String(unitCode));

    const items = extractItemsFromPayload(p);
    for (const it of items) {
      const key = matchGroupByCode(it.code, product);
      if (!key || !it.code) continue;

      const row: TxnRow = {
        dateFa,
        shift,
        unitCode,
        unitName: null,
        code: it.code,
        nameFa: null,
        amount: it.qty,
        description: p?.description ?? null,
      };

      matCodes.add(it.code);
      const bucket = groups.get(key)!;
      bucket.rows.push(row);
      bucket.total += it.qty;
    }
  }

  // Look up raw material names in KardexItem
  if (matCodes.size) {
    const items = await prisma.kardexItem.findMany({
      where: { code: { in: [...matCodes] } },
      select: { code: true, nameFa: true },
    });
    const nameMap = new Map(items.map((i) => [i.code, i.nameFa]));
    for (const g of groups.values()) {
      for (const r of g.rows) {
        r.nameFa = nameMap.get(r.code) ?? r.nameFa ?? null;
      }
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

  // Keep only materials that have at least one row
  const present = ([
    { key: "corn",   labelFa: "ذرت" },
    { key: "oil",    labelFa: "روغن" },
    { key: "lime",   labelFa: "آهک" },
    { key: "spice",  labelFa: "ادویه" },   // ← will show both 13… and 32xxx{product}xxxx
    { key: "selfon", labelFa: "سلفون" },
    { key: "box",    labelFa: "کارتن" },
  ] as const)
    .map(({ key, labelFa }) => {
      const bucket = groups.get(key as GroupKey)!;
      return { key, labelFa, rows: bucket.rows, total: bucket.total };
    })
    .filter((g) => g.rows.length > 0);

  const nf = (n: number) =>
    n.toLocaleString("en-US", { maximumFractionDigits: 3 });

  return (
    <section className="w-full">
      {/* Title WITHOUT date */}
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
                      <th className="px-3 py-2">واحد</th>
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
                        <td className="px-3 py-2">{r.unitName ?? ""}</td>
                        <td className="px-3 py-2">{r.description ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-gray-50 font-semibold">
                      <td className="px-3 py-2" colSpan={6}>جمع</td>
                      <td className="px-3 py-2">{nf(g.total)}</td>
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
