// app/(protected)/reports/daily-production/components/WasteDetailsSection.tsx
import { prisma } from "@/lib/db";
import { headers, cookies } from "next/headers";
import { unstable_noStore as noStore } from "next/cache";

type ProductKey = "1" | "2";
type Props = { date: string; product: ProductKey };

/* -------------------- tiny utils -------------------- */
function pick<T = any>(o: any, keys: string[], def?: any): T | undefined {
  for (const k of keys) {
    const val = k.split(".").reduce((acc: any, kk) => (acc ? acc[kk] : undefined), o);
    if (val !== undefined && val !== null && val !== "") return val as T;
  }
  return def;
}
function faToEnDigits(s: any): string {
  const str = String(s ?? "");
  const map: Record<string, string> = {
    "۰":"0","۱":"1","۲":"2","۳":"3","۴":"4","۵":"5","۶":"6","۷":"7","۸":"8","۹":"9",
    "٠":"0","١":"1","٢":"2","٣":"3","٤":"4","٥":"5","٦":"6","٧":"7","٨":"8","٩":"9",
  };
  return str.replace(/[0-9۰-۹٠-٩]/g, (ch) => map[ch] ?? ch);
}
function onlyDigits(input: any): string | undefined {
  if (input == null) return undefined;
  const s = faToEnDigits(String(input));
  const d = s.replace(/[^\d]/g, "");
  return d || undefined;
}
function num(x: any): number { const n = Number(x); return Number.isFinite(n) ? n : 0; }
function entryDateStr(obj: any): string | undefined {
  return pick<string>(obj, ["date", "payloadDate", "tarikh", "payload.date"]);
}
function toJalali(dateStr?: string): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr.length <= 10 ? `${dateStr}T00:00:00Z` : dateStr);
    const fmt = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "2-digit", day: "2-digit" });
    return fmt.format(d);
  } catch { return dateStr; }
}
function payloadShift(obj: any): number | undefined {
  const s = pick<any>(obj, ["shift", "شیفت"]);
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/* -------------------- tableSelect helpers -------------------- */
type TS = { code?: string; label?: string };
function fromObjectToTS(v: any): TS {
  if (v && typeof v === "object") {
    const code = v.code ?? v.value ?? v.id ?? v.key ?? v.kardexCode ?? v.itemCode;
    const label = v.label ?? v.title ?? v.titleFa ?? v.nameFa ?? v.name ?? v.نام ?? v.شرح;
    return { code: code ? String(code) : undefined, label: label ? String(label) : undefined };
  }
  return {};
}
function resolveTableSelect(obj: any, base: string): TS {
  const direct = pick<any>(obj, [base]);
  if (direct && typeof direct === "object") {
    const ts = fromObjectToTS(direct);
    if (ts.code || ts.label) return ts;
  }
  const label =
    pick<string>(obj, [
      `${base}Label`, `${base}_label`, `${base}Title`, `${base}_title`,
      `${base}Name`, `${base}_name`, `عنوان_${base}`, `نام_${base}`,
    ]) ?? undefined;

  const code =
    (typeof direct === "string" ? direct : undefined) ??
    pick<string>(obj, [`${base}Code`, `${base}_code`]) ??
    pick<string>(obj, [base]);

  return { code: code ? String(code) : undefined, label: label ? String(label) : undefined };
}
function wasteAmount(values: any): number {
  return num(pick(values, ["amount", "qty", "مقدار", "تعداد"], 0));
}
function payloadLabelFallback(values: any): string | undefined {
  return pick<string>(values, ["nameFa", "itemName", "titleFa", "نام", "شرح"]);
}

/* -------------------- form code → id -------------------- */
async function getFormIdsByCodes(formCodes: string[]): Promise<string[]> {
  const forms = await prisma.form.findMany({
    where: { code: { in: formCodes } },
    select: { id: true },
  });
  return forms.map(f => f.id);
}

/* -------------------- fetch by payload.date only -------------------- */
async function getWasteEntriesByDate(date: string, formCodes: string[]) {
  const formIds = await getFormIdsByCodes(formCodes);
  if (formIds.length === 0) return [];
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

/* -------------------- FixedInformation lookup (bulk) -------------------- */
async function fetchFixedTitles(codes: string[]): Promise<Map<string, string>> {
  noStore();
  const map = new Map<string, string>();
  const uniq = Array.from(new Set(codes.filter(Boolean).map(c => onlyDigits(c) ?? "").filter(Boolean))).slice(0, 500);
  if (uniq.length === 0) return map;

  const h = await headers();
  const ck = await cookies();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const base = process.env.NEXT_PUBLIC_APP_URL || (host ? `${proto}://${host}` : "");
  const cookieHeader = ck.getAll().map(c => `${c.name}=${c.value}`).join("; ");

  const params = new URLSearchParams();
  params.set("codes", uniq.join(","));
  const url = `${base}/api/lookups/fixed?${params.toString()}`;

  try {
    const r = await fetch(url, {
      headers: { cookie: cookieHeader, accept: "application/json" },
      cache: "no-store",
      next: { revalidate: 0 },
    });
    const items: any[] = r.ok ? (await r.json().catch(() => null))?.items ?? [] : [];
    for (const it of items) {
      const code = onlyDigits(it?.code) ?? "";
      const title = it?.title ?? it?.titleFa ?? it?.nameFa ?? it?.name ?? it?.label ?? "";
      if (code) map.set(code, title ? String(title) : code);
    }
    const missing = uniq.filter(c => !map.has(c));
    if (missing.length) {
      await Promise.allSettled(missing.map(async (c) => {
        const p = new URLSearchParams(); p.set("codes", c);
        const u = `${base}/api/lookups/fixed?${p.toString()}`;
        const rr = await fetch(u, {
          headers: { cookie: cookieHeader, accept: "application/json" },
          cache: "no-store",
          next: { revalidate: 0 },
        });
        if (!rr.ok) { map.set(c, c); return; }
        const jj = await rr.json().catch(() => null);
        const it1 = Array.isArray(jj?.items) ? jj.items.find((x: any) => onlyDigits(x?.code) === c) : null;
        const t1 = it1?.title ?? it1?.titleFa ?? it1?.nameFa ?? it1?.name ?? it1?.label ?? "";
        map.set(c, t1 ? String(t1) : c);
      }));
    }
  } catch {
    for (const c of uniq) map.set(c, c);
  }
  return map;
}

/* -------------------- allowed waste codes per product -------------------- */
const WASTE_CODES_BY_PRODUCT: Record<ProductKey, string[]> = {
  "1": ["5203280100", "5203290100", "5103420000", "5102030100", "5101020100"], // چیپس
  "2": ["5102000000", "5101000200"],                                         // پاپکورن
};
function isAllowedWasteForProduct(code: string | undefined, product: ProductKey): boolean {
  if (!code) return false;
  const d = onlyDigits(code);
  if (!d) return false;
  return WASTE_CODES_BY_PRODUCT[product].includes(d);
}

/* -------------------- Component (pivot) -------------------- */
export default async function WasteDetailsSection({ date, product }: Props) {
  // 1) fetch entries (forms 1020508 + 1020400) by payload.date
  const entries = await getWasteEntriesByDate(date, ["1020508", "1020400"]);

  // 2) collect waste codes + amounts by shift
  type Wire = { wasteCode: string; wasteLabelFromPayload?: string; shift?: number; amount: number };
  const wires: Wire[] = [];
  const codes = new Set<string>();

  for (const e of entries) {
    const v = (e.payload ?? {}) as any;
    const wasteTS = resolveTableSelect(v, "waste");
    const rawCode =
      wasteTS.code ??
      pick<string>(v, ["code", "kardexCode", "itemCode", "کد", "کد_کاردکس"]);
    const code = onlyDigits(rawCode);
    const amount = wasteAmount(v);
    if (!code || !amount) continue;

    // Optional guard: if payload.product exists and is different, skip
    const pval = String(pick<any>(v, ["product", "payload.product"], "") ?? "");
    if (pval && pval !== product) continue;

    // ✅ product-specific code whitelist
    if (!isAllowedWasteForProduct(code, product)) continue;

    const sh = payloadShift(v); // 1/2/3 (others ignored for columns but counted in sum)
    wires.push({
      wasteCode: code,
      wasteLabelFromPayload: wasteTS.label ?? payloadLabelFallback(v),
      shift: sh,
      amount,
    });
    codes.add(code);
  }

  if (wires.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 text-gray-700">
        برای تاریخ انتخاب‌شده، رکوردی از «ضایعات» یافت نشد.
      </div>
    );
  }

  // 3) resolve waste titles via FixedInformation
  const titleMap = await fetchFixedTitles(Array.from(codes));

  // 4) pivot: rows by wasteTitle; cols: date | s1 | s2 | s3 | sum
  type Row = { wasteTitle: string; s1: number; s2: number; s3: number; sum: number };
  const pivot = new Map<string, Row>();

  for (const w of wires) {
    const title =
      titleMap.get(w.wasteCode) ||
      w.wasteLabelFromPayload ||
      w.wasteCode;

    const row = pivot.get(title) ?? { wasteTitle: title, s1: 0, s2: 0, s3: 0, sum: 0 };
    if (w.shift === 1) row.s1 += w.amount;
    else if (w.shift === 2) row.s2 += w.amount;
    else if (w.shift === 3) row.s3 += w.amount;
    row.sum += w.amount;

    pivot.set(title, row);
  }

  const rows = Array.from(pivot.values()).sort((a, b) =>
    a.wasteTitle.localeCompare(b.wasteTitle, "fa")
  );

  const dateJ = toJalali(date);

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-4 py-3 font-semibold text-gray-900">
        جزئیات ضایعات
      </div>

      <div className="overflow-x-auto p-4">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-white">
            <tr>
              <th className="px-3 py-2 text-right text-sm font-medium text-gray-900">نوع ضایعات</th>
              <th className="px-3 py-2 text-right text-sm font-medium text-gray-900">تاریخ</th>
              <th className="px-3 py-2 text-right text-sm font-medium text-gray-900">شیفت ۱</th>
              <th className="px-3 py-2 text-right text-sm font-medium text-gray-900">شیفت ۲</th>
              <th className="px-3 py-2 text-right text-sm font-medium text-gray-900">شیفت ۳</th>
              <th className="px-3 py-2 text-left  text-sm font-medium text-gray-900">جمع</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {rows.map((r) => (
              <tr key={r.wasteTitle}>
                <td className="px-3 py-2">{r.wasteTitle}</td>
                <td className="px-3 py-2 whitespace-nowrap">{dateJ}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.s1 ? r.s1.toLocaleString("fa-IR") : "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.s2 ? r.s2.toLocaleString("fa-IR") : "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.s3 ? r.s3.toLocaleString("fa-IR") : "—"}</td>
                <td className="px-3 py-2 text-left font-semibold">{r.sum.toLocaleString("fa-IR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
