// app/(protected)/reports/daily-production/components/PauseSummarySection.tsx
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type Props = {
  date: string;          // YYYY-MM-DD (Gregorian)
  product: "1" | "2";    // "1" chips, "2" popcorn (from payload.line)
  hours?: number;        // planned working hours (default 24)
};

/* ---------- tiny utils ---------- */
function pick<T = any>(o: any, keys: string[], def?: any): T | undefined {
  for (const k of keys) {
    const val = k.split(".").reduce((acc: any, kk) => (acc ? acc[kk] : undefined), o);
    if (val !== undefined && val !== null && val !== "") return val as T;
  }
  return def;
}
function isHHMM(s?: string): boolean { return !!s && /^\d{1,2}:\d{2}$/.test(s); }
function parseDateTime(dateISO: string, val?: string): Date | null {
  if (!val) return null;
  if (isHHMM(val)) return new Date(`${dateISO}T${val}:00`);
  const d = new Date(val);
  return isNaN(+d) ? null : d;
}
function diffMinutes(dateISO: string, start?: string, end?: string): number {
  const s = parseDateTime(dateISO, start);
  const e = parseDateTime(dateISO, end);
  if (!s || !e) return 0;
  let m = Math.round((+e - +s) / 60000);
  if (m < 0) m += 24 * 60; // across midnight
  return m;
}
const nf = (n: number, frac = 2) =>
  n.toLocaleString("en-US", { maximumFractionDigits: frac, minimumFractionDigits: 0 });

/* ---------- data ---------- */
async function getForm102500Id() {
  const f = await prisma.form.findFirst({ where: { code: "102500" }, select: { id: true } });
  return f?.id ?? null;
}

/** Strictly by payload.date and payload.line == product */
async function getPauseEntries(formId: string, date: string, product: "1" | "2") {
  return prisma.formEntry.findMany({
    where: {
      formId,
      AND: [
        {
          OR: [
            { payload: { path: ["date"], equals: date } },
            { payload: { path: ["payloadDate"], equals: date } },
            { payload: { path: ["tarikh"], equals: date } },
            { payload: { path: ["payload", "date"], equals: date } },
          ],
        },
        {
          OR: [
            { payload: { path: ["line"], equals: product } },
            { payload: { path: ["line"], equals: Number(product) } as any },
            { payload: { path: ["line", "value"], equals: product } },
            { payload: { path: ["line", "value"], equals: Number(product) } as any },
          ],
        },
      ],
    },
    select: { id: true, payload: true },
    orderBy: { id: "asc" },
  });
}

/* ---------- component ---------- */
export default async function PauseSummarySection({ date, product, hours = 24 }: Props) {
  const formId = await getForm102500Id();
  if (!formId) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 text-gray-700">
        فرم 102500 یافت نشد.
      </div>
    );
  }

  const entries = await getPauseEntries(formId, date, product);

  let totalPauseMin = 0;
  for (const e of entries) {
    const p = (e.payload ?? {}) as any;
    const dateISO = p?.date ?? p?.payloadDate ?? p?.tarikh ?? p?.payload?.date ?? date;
    const start = pick<string>(p, ["start", "شروع"]);
    const end   = pick<string>(p, ["end", "پایان"]);
    totalPauseMin += diffMinutes(String(dateISO), start, end);
  }

  const pauseHours = totalPauseMin / 60;
  const productionHours = Math.max(0, hours - pauseHours);
  const count = entries.length;
  const pct = productionHours > 0 ? (pauseHours / productionHours) * 100 : 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-white font-semibold mt-4">
      <div className="border-b border-gray-200 px-4 py-3 font-semibold text-gray-900">
        خلاصه توقفات خط
      </div>
      <div className="p-4">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-white">
            <tr>
              <th className="px-3 py-2 text-right font-medium text-gray-900">شرح</th>
              <th className="px-3 py-2 text-left  font-medium text-gray-900">مقدار</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            <tr>
              <td className="px-3 py-2">زمان تولید (ساعت)</td>
              <td className="px-3 py-2 text-left">{nf(productionHours)}</td>
            </tr>
            <tr>
              <td className="px-3 py-2">زمان توقف (ساعت)</td>
              <td className="px-3 py-2 text-left">{nf(pauseHours)}</td>
            </tr>
            <tr>
              <td className="px-3 py-2">تعداد توقفات خط</td>
              <td className="px-3 py-2 text-left">{nf(count, 0)}</td>
            </tr>
            <tr>
              <td className="px-3 py-2">درصد توقفات خط</td>
              <td className="px-3 py-2 text-left">{productionHours > 0 ? `${pct.toFixed(2)}%` : "—"}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
