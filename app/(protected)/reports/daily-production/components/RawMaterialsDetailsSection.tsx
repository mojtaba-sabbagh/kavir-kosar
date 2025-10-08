// app/(protected)/reports/daily-production/components/RawMaterialsDetailsSection.tsx
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type Props = { date: string };

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
const RAW_MATERIAL_GROUPS = [
  { key: "corn",   labelFa: "ذرت",   prefixes: ["110"] },
  { key: "oil",    labelFa: "روغن",  prefixes: ["1204"] },
  { key: "lime",   labelFa: "آهک",   prefixes: ["1522"] },
  { key: "spice",  labelFa: "ادویه", prefixes: ["13"] },
  { key: "selfon", labelFa: "سلفون", prefixes: ["22"] },
  { key: "box",    labelFa: "کارتن", prefixes: ["2100"] },
] as const;
type GroupKey = typeof RAW_MATERIAL_GROUPS[number]["key"];

function matchGroupByCode(code?: string): GroupKey | undefined {
  const s = cleanCode(code);
  if (!s) return;
  if (s.startsWith("11"))   return "corn";
  if (s.startsWith("1204")) return "oil";
  if (s.startsWith("1522")) return "lime";
  if (s.startsWith("13"))   return "spice";
  if (s.startsWith("22"))   return "selfon";
  if (s.startsWith("2100")) return "box";
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
  amount: number;
  description?: string | null;
};

/* -------------------- component -------------------- */
export default async function RawMaterialsDetailsSection({ date }: Props) {
  // DB: only finalConfirmed & payload.date exact match
  const entries = await prisma.formEntry.findMany({
    where: {
      form: { code: "1031100" },
      status: "finalConfirmed",
        AND: [
            { payload: { path: ['date'],    equals: date } },   
            { payload: { path: ['product'], equals: '1'  } },
            ],    
        },
    select: { id: true, payload: true, finalConfirmedAt: true, createdAt: true },
    orderBy: { finalConfirmedAt: "asc" },
  });

  // Prepare group buckets
  const groups = new Map<GroupKey, { labelFa: string; total: number; rows: TxnRow[] }>();
  for (const g of RAW_MATERIAL_GROUPS) groups.set(g.key, { labelFa: g.labelFa, total: 0, rows: [] });

  // Collect lookups
  const matCodes = new Set<string>();
  const unitCodes = new Set<string>();

  // Fill buckets
  for (const e of entries) {
    const p = (e.payload as any) ?? {};
    const code = cleanCode(p?.raw_material ?? p?.rawMaterials ?? p?.mavadAvalieh);
    const amount = parseAmount(p?.amount ?? p?.qty ?? p?.quantity ?? p?.value ?? p?.count);
    if (!code || !Number.isFinite(amount) || amount === 0) continue;

    const key = matchGroupByCode(code);
    if (!key) continue;

    const payloadDate = normalizeIsoDateLike(p?.date) || date; // fallback to requested date
    const row: TxnRow = {
      dateFa: toJalali(payloadDate),
      shift: parseShift(p?.shift ?? p?.workShift ?? p?.shiftNo),
      unitCode: p?.unit ?? null,
      unitName: null, // to be filled after lookup
      code,
      nameFa: null,   // to be filled after lookup
      amount,
      description: p?.description ?? null,
    };

    matCodes.add(code);
    if (row.unitCode) unitCodes.add(String(row.unitCode));

    const bucket = groups.get(key)!;
    bucket.rows.push(row);
    bucket.total += amount;
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
  const present = RAW_MATERIAL_GROUPS
    .map(({ key, labelFa }) => {
      const bucket = groups.get(key)!;
      return { key, labelFa, rows: bucket.rows, total: bucket.total };
    })
    .filter((g) => g.rows.length > 0);

  const nf = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 3 });

  return (
    <section className="w-full">
      <h2 className="text-xl font-bold mb-3">جزئیات تراکنش مواد اولیه – {toJalali(date)}</h2>

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
                      <th className="px-3 py-2">کد ماذه اولیه</th>
                      <th className="px-3 py-2">نام ماده اولیه</th>
                      <th className="px-3 py-2">مقدار</th>
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
                        <td className="px-3 py-2">{r.description ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-gray-50 font-semibold">
                      <td className="px-3 py-2" colSpan={7}>جمع</td>
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
// app/(protected)/reports/daily-production/components/ProductsSummarySection.tsx