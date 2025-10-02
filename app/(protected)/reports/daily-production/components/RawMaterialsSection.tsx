// app/(protected)/reports/daily-production/components/RawMaterialsSection.tsx
import { prisma } from "@/lib/db";
export const dynamic = "force-dynamic";

/** Format YYYY-MM-DD (Gregorian) as Persian (Jalali). Falls back to the input on failure. */
function toJalali(isoDate: string, useLatinDigits = false): string {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;

  // Use noon UTC to avoid local-TZ day shifts during formatting.
  const atNoonUTC = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

  try {
    const fmt = new Intl.DateTimeFormat(
      // arabext → Persian digits; swap to 'latn' if you want Latin digits
      useLatinDigits ? "fa-IR-u-ca-persian-nu-latn" : "fa-IR-u-ca-persian",
      { year: "numeric", month: "2-digit", day: "2-digit" }
    );
    return fmt.format(atNoonUTC);
  } catch {
    return isoDate; // in case the runtime lacks ICU support
  }
}
/** Convert Persian/Arabic-Indic digits to Latin digits inside a string. */
function faToEnDigits(s: string): string {
  if (typeof s !== "string") return String(s ?? "");
  // Persian digits: ۰۱۲۳۴۵۶۷۸۹  | Arabic-Indic digits: ٠١٢٣٤٥٦٧٨٩
  const map: Record<string, string> = {
    "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
    "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
    "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
    "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  };
  return s.replace(/[0-9۰-۹٠-٩]/g, ch => map[ch] ?? ch);
}
/** Keep only Latin digits from any input (strips RTL marks, spaces, etc.) */
function cleanCode(input: any): string | undefined {
  if (input == null) return undefined;
  const s = faToEnDigits(String(input));
  const digits = s.replace(/[^\d]/g, ""); // remove anything not 0-9
  return digits || undefined;
}

type Props = {
  /** Gregorian yyyy-mm-dd that matches your form's `payload.date` */
  date: string;
  /** Working hours used only for the Per-Hour column (total / hours). Defaults to 24. */
  hours?: number;
  /** Which shifts to include (1|2|3). Defaults to all. */
  shifts?: (1 | 2 | 3)[];
  /** When true, only include confirmed/finalConfirmed (recommended). Default: true */
  onlyConfirmed?: boolean;
};

/** Business grouping by Kardex code prefix */
const RAW_MATERIAL_GROUPS = [
  { key: "corn",    labelFa: "ذرت",   prefixes: ["11"] },
  { key: "oil",     labelFa: "روغن",  prefixes: ["1204"] },
  { key: "lime",    labelFa: "آهک",   prefixes: ["1522"] },
  { key: "spice",   labelFa: "ادویه", prefixes: ["13"] },
  { key: "selfon",  labelFa: "سلفون", prefixes: ["22"] },
  { key: "box",     labelFa: "کارتن", prefixes: ["2100"] },
] as const;

type GroupKey = typeof RAW_MATERIAL_GROUPS[number]["key"];
type ShiftNum = 1 | 2 | 3;

type Totals = Record<GroupKey, { shifts: Record<ShiftNum, number>; total: number }>;

function initTotals(shifts: ShiftNum[]): Totals {
  const base: Totals = Object.fromEntries(
    RAW_MATERIAL_GROUPS.map(({ key }) => [
      key,
      { shifts: { 1: 0, 2: 0, 3: 0 } as Record<ShiftNum, number>, total: 0 },
    ])
  ) as Totals;

  // zero unwanted shifts too (harmless)
  (base as any);
  return base;
}

function parseShift(value: any): ShiftNum | undefined {
  const n = Number(value);
  return n === 1 || n === 2 || n === 3 ? (n as ShiftNum) : undefined;
}

function extractItemsFromPayload(p: any): { code?: string; qty: number }[] {
  const raw = p?.raw_material ?? p?.rawMaterials ?? p?.mavadAvalieh;

  const amtRaw = p?.amount ?? p?.qty ?? p?.quantity ?? p?.value ?? p?.count;
  const amt = typeof amtRaw === "string"
    ? parseFloat(faToEnDigits(amtRaw).replace(/,/g, ""))
    : Number(amtRaw);

  // Case A: single code + amount
  if (typeof raw === "string" || typeof raw === "number") {
    const code = cleanCode(raw);
    const qty = Number.isFinite(amt) ? amt : 0;
    return code && qty > 0 ? [{ code, qty }] : [];
  }

  // Case B: array of rows
  if (Array.isArray(raw)) {
    const items: { code?: string; qty: number }[] = [];
    for (const r of raw) {
      const rawCode =
        r?.code ?? r?.kardexCode ?? r?.itemCode ??
        r?.kardex?.code ?? r?.item?.code ??
        (typeof r?.name === "string" && /^\d/.test(faToEnDigits(r.name)) ? r.name : undefined);

      const code = cleanCode(rawCode);
      const qRaw = r?.qty ?? r?.quantity ?? r?.amount ?? r?.count ?? r?.value ?? (typeof r === "number" ? r : undefined);
      const qty = typeof qRaw === "string" ? parseFloat(faToEnDigits(qRaw).replace(/,/g, "")) : Number(qRaw);

      if (code && Number.isFinite(qty) && qty !== 0) items.push({ code, qty });
    }
    return items;
  }

  // Case C: object map { "1101000001": 500, ... }
  if (raw && typeof raw === "object") {
    return Object.entries(raw)
      .map(([k, v]) => {
        const code = cleanCode(k);
        const qty = typeof v === "string" ? parseFloat(faToEnDigits(v).replace(/,/g, "")) : Number(v);
        return { code, qty };
      })
      .filter((x) => x.code && Number.isFinite(x.qty) && x.qty !== 0);
  }

  return [];
}

function matchGroupByCode(code?: string): GroupKey | undefined {
  const s = cleanCode(code);
  if (!s) return;
  for (const g of RAW_MATERIAL_GROUPS) {
    if (g.prefixes.some((p) => s.startsWith(p))) return g.key;
  }
  return;
}


/** Safe start/end of the given yyyy-mm-dd in UTC for DB prefilter by createdAt */
function dayBoundsUTC(date: string): { start: Date; end: Date } {
  // Treat input as UTC midnight range to narrow DB reads; actual filter happens on payload.date
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(`${date}T23:59:59.999Z`);
  return { start, end };
}

function fmt(n: number, frac = 3) {
  return n.toLocaleString("en-US", { maximumFractionDigits: frac, minimumFractionDigits: 0 });
}

export default async function RawMaterialsSection({
  date,
  hours = 24,
  shifts = [1, 2, 3],
  onlyConfirmed = true,
}: Props) {
  const wantedShifts = (Array.from(new Set(shifts)) as ShiftNum[]).filter((s): s is ShiftNum => [1, 2, 3].includes(s));
  const totals = initTotals(wantedShifts);

  const { start, end } = dayBoundsUTC(date);

  // Pull candidate entries for form code 1031107; final filtering is done in JS on payload.date
const wantedGregorian = date; // "YYYY-MM-DD" from URL

const entries = await prisma.formEntry.findMany({
  where: {
    form: { code: "1031107" },
    status: "finalConfirmed",                          
    payload: { path: ["date"], equals: wantedGregorian },
    // If some rows are saved in Jalali, also OR this:
    // OR: [{ payload: { path: ["date"], equals: gregToJalaliLatn(wantedGregorian) || "" } }],
  },
  select: {
    id: true,
    payload: true,
    status: true,
    finalConfirmedAt: true,
    createdAt: true,
  },
  orderBy: { createdAt: "desc" },
});

  // Filter by payload.date === props.date (string compare; adapt if you store as Date)
  const sameDay = entries.filter((e) => {
    const p = (e.payload as any) ?? {};
    const d = p?.date ?? p?.productionDate ?? p?.tarikh;
    return typeof d === "string" ? d.slice(0, 10) === date : false;
  });

  for (const e of sameDay) {
    const p = (e.payload as any) ?? {};
    const shift = parseShift(p?.shift ?? p?.workShift ?? p?.shiftNo);
    if (!shift || !wantedShifts.includes(shift)) continue;

    const items = extractItemsFromPayload(p);

    for (const it of items) {
      const g = matchGroupByCode(it.code);
      if (!g) continue;
      totals[g].shifts[shift] += it.qty;
      totals[g].total += it.qty;
    }
  }

  const hasAny = RAW_MATERIAL_GROUPS.some(({ key }) => totals[key].total !== 0);

  return (
    <section className="w-full">
        <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        {/* Card header */}
        <div className="px-4 py-3 border-b">
            <h2 className="text-xl font-bold">
            مصرف مواد اولیه – {toJalali(date)}
            </h2>
        </div>

        {/* Card body */}
        <div className="p-3">
            {!hasAny ? (
            <div className="text-sm text-gray-600 border rounded-lg p-3">
                رکوردی برای این تاریخ/شیفت‌ها یافت نشد.
            </div>
            ) : (
            <div className="overflow-x-auto">
                <table className="min-w-[720px] w-full text-sm">
                <thead className="bg-gray-50">
                    <tr className="text-right">
                    <th className="px-3 py-2">ماده اولیه</th>
                    <th className="px-3 py-2">شیفت ۱</th>
                    <th className="px-3 py-2">شیفت ۲</th>
                    <th className="px-3 py-2">شیفت ۳</th>
                    <th className="px-3 py-2">جمع کل</th>
                    </tr>
                </thead>
                <tbody>
                    {RAW_MATERIAL_GROUPS.map(({ key, labelFa }) => {
                    const row = totals[key];
                    const fmt = (n: number) =>
                        n.toLocaleString("en-US", { maximumFractionDigits: 3, minimumFractionDigits: 0 });
                    return (
                        <tr key={key} className="border-t">
                        <td className="px-3 py-2 font-medium">{labelFa}</td>
                        <td className="px-3 py-2">{fmt(row.shifts[1])}</td>
                        <td className="px-3 py-2">{fmt(row.shifts[2])}</td>
                        <td className="px-3 py-2">{fmt(row.shifts[3])}</td>
                        <td className="px-3 py-2 font-semibold">{fmt(row.total)}</td>
                        </tr>
                    );
                    })}
                </tbody>
                </table>
            </div>
            )}
        </div>
        </div>
    </section>
);
}
