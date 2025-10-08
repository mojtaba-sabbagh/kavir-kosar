// app/(protected)/reports/daily-production/components/WasteSummarySection.tsx
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
function num(x: any): number { const n = Number(x); return Number.isFinite(n) ? n : 0; }
function faToEnDigits(s: any): string {
  const str = String(s ?? "");
  const map: Record<string, string> = {
    "۰":"0","۱":"1","۲":"2","۳":"3","۴":"4","۵":"5","۶":"6","۷":"7","۸":"8","۹":"9",
    "٠":"0","١":"1","٢":"2","٣":"3","٤":"4","٥":"5","٦":"6","٧":"7","٨":"8","٩":"9",
  };
  return str.replace(/[0-9۰-۹٠-٩]/g, (ch) => map[ch] ?? ch);
}
function onlyDigits(v: any): string {
  return faToEnDigits(String(v ?? "")).replace(/[^\d]/g, "");
}
function codeFromAny(v: any): string {
  if (v == null) return "";
  if (typeof v === "object") {
    const raw = v.code ?? v.value ?? v.id ?? v.key ?? v.kardexCode ?? v.itemCode;
    return onlyDigits(raw);
  }
  return onlyDigits(v);
}
function amountOf(obj: any): number { return num(pick(obj, ["amount", "qty", "مقدار", "تعداد"], 0)); }
function patternToRegex(p: string) { return new RegExp("^" + p.replace(/\*/g, "\\d") + "$"); }

/* -------------------- form code → id -------------------- */
async function getFormIdsByCodes(formCodes: string[]): Promise<string[]> {
  const forms = await prisma.form.findMany({ where: { code: { in: formCodes } }, select: { id: true } });
  return forms.map((f) => f.id);
}

/* ----------- fetch entries by payload.date (no createdAt) ----------- */
async function getFormEntries(date: string, formCodes: string[]) {
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

/* -------------------- FixedInformation lookup -------------------- */
async function fetchFixedTitles(codes: string[]): Promise<Map<string, string>> {
  noStore();
  const map = new Map<string, string>();
  const uniq = Array.from(new Set(codes.filter(Boolean).map(onlyDigits))).filter(Boolean).slice(0, 200);
  if (uniq.length === 0) return map;

  const h = await headers();
  const ck = await cookies();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const base = process.env.NEXT_PUBLIC_APP_URL || (host ? `${proto}://${host}` : "");
  const cookieHeader = ck.getAll().map((c) => `${c.name}=${c.value}`).join("; ");

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
      const c = onlyDigits(it?.code);
      const t = it?.title ?? it?.titleFa ?? it?.nameFa ?? it?.name ?? it?.label ?? "";
      if (c) map.set(c, t ? String(t) : c);
    }
    // Fallback per-code for any misses
    const missing = uniq.filter((c) => !map.has(c));
    if (missing.length) {
      await Promise.allSettled(
        missing.map(async (c) => {
          const p = new URLSearchParams(); p.set("codes", c);
          const u = `${base}/api/lookups/fixed?${p.toString()}`;
          const rr = await fetch(u, { headers: { cookie: cookieHeader, accept: "application/json" }, cache: "no-store", next: { revalidate: 0 } });
          const jj = rr.ok ? (await rr.json().catch(() => null)) : null;
          const it1 = Array.isArray(jj?.items) ? jj.items.find((x: any) => onlyDigits(x?.code) === c) : null;
          const t1 = it1?.title ?? it1?.titleFa ?? it1?.nameFa ?? it1?.name ?? it1?.label ?? "";
          map.set(c, t1 ? String(t1) : c);
        })
      );
    }
  } catch {
    for (const c of uniq) map.set(c, c);
  }
  return map;
}

/* -------------------- per-product rules -------------------- */
type Rule = { wasteCode: string; rawEquals?: string; rawPatterns?: string[] };

const RULES_BY_PRODUCT: Record<ProductKey, Rule[]> = {
  // چیپس
  "1": [
    { wasteCode: "5203280100", rawEquals: "1101000001" }, // درصد ضایعات برگه
    { wasteCode: "5203290100", rawEquals: "1101000001" }, // درصد ضایعات خمیر
    { wasteCode: "5103420000", rawEquals: "1101000001" }, // درصد ضایعات زیرماردن
    { wasteCode: "5102030100", rawPatterns: ["22***1****"] }, // سلفون (سری 1)
    { wasteCode: "5101020100", rawPatterns: ["21***1****"] }, // کارتن (سری 1)
  ],
  // پاپکورن (طبق دستور شما برای خلاصه)
  "2": [
    { wasteCode: "5102030100", rawPatterns: ["22***2****"] }, // سلفون (سری 2)
    { wasteCode: "5101020100", rawPatterns: ["21***2****"] }, // کارتن (سری 2)
  ],
};

function makeRawSelector(r: Rule): (c: string) => boolean {
  if (r.rawEquals) {
    const eq = onlyDigits(r.rawEquals);
    return (c) => onlyDigits(c) === eq;
  }
  if (r.rawPatterns?.length) {
    const regs = r.rawPatterns.map(patternToRegex);
    return (c) => regs.some((re) => re.test(onlyDigits(c)));
  }
  return () => false;
}

export default async function WasteSummarySection({ date, product }: Props) {
  const RULES = RULES_BY_PRODUCT[product];

  // 1) fetch waste + raw entries by payload date
  const wasteEntries = await getFormEntries(date, ["1020508", "1020400"]);
  const rawEntries   = await getFormEntries(date, ["1031100"]);

  // 2) aggregate by code (respect product when present in payload)
  const wasteByCode = new Map<string, number>();
  for (const e of wasteEntries) {
    const v = (e.payload ?? {}) as any;
    const pval = String(pick<any>(v, ["product", "payload.product"], "") ?? "");
    if (pval && pval !== product) continue; // if payload.product is set, enforce it

    const code = codeFromAny(v?.waste) || codeFromAny(
      pick<string>(v, ["code", "kardexCode", "itemCode", "کد", "کد_کاردکس"])
    );
    const amt = amountOf(v);
    if (!code || !amt) continue;

    // only count waste codes that exist in current product's RULES
    if (!RULES.some((r) => onlyDigits(r.wasteCode) === code)) continue;

    wasteByCode.set(code, (wasteByCode.get(code) ?? 0) + amt);
  }

  const rawByCode = new Map<string, number>();
  for (const e of rawEntries) {
    const v = (e.payload ?? {}) as any;
    const pval = String(pick<any>(v, ["product", "payload.product"], "") ?? "");
    if (pval && pval !== product) continue; // enforce selected product if provided

    const code =
      codeFromAny(v?.raw_material) ||
      codeFromAny(pick<string>(v, ["rawMaterial", "raw_material", "code", "kardexCode", "itemCode"]));
    const amt = amountOf(v);
    if (!code || !amt) continue;

    rawByCode.set(code, (rawByCode.get(code) ?? 0) + amt);
  }

  // 3) fetch labels for waste codes from FixedInformation (field: title)
  const labelMap = await fetchFixedTitles(RULES.map((r) => r.wasteCode));

  // 4) compute rows
  const rows = RULES.map((r) => {
    const wasteKey = onlyDigits(r.wasteCode);
    const labelFa = labelMap.get(wasteKey) || r.wasteCode;

    const wasteSum = wasteByCode.get(wasteKey) ?? 0;

    const selector = makeRawSelector(r);
    let rawSum = 0;
    for (const [c, a] of rawByCode.entries()) if (selector(c)) rawSum += a;

    const pct = rawSum > 0 ? (wasteSum / rawSum) * 100 : 0;

    return { labelFa, wasteSum, rawSum, pct };
  });

  const grandWaste = rows.reduce((s, r) => s + r.wasteSum, 0);
  const grandRaw   = rows.reduce((s, r) => s + r.rawSum, 0);

  // 5) render
  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-4 py-3 font-semibold text-gray-900">
        خلاصه درصد ضایعات (نسبت به مصرف مواد اولیه روز)
      </div>
      <div className="overflow-x-auto p-4">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-white">
            <tr>
              <th className="px-3 py-2 text-right text-sm font-medium text-gray-900">شرح</th>
              <th className="px-3 py-2 text-left  text-sm font-medium text-gray-900">جمع ضایعات</th>
              <th className="px-3 py-2 text-left  text-sm font-medium text-gray-900">مصرف مواد پایه</th>
              <th className="px-3 py-2 text-left  text-sm font-medium text-gray-900">% ضایعات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="px-3 py-2">{r.labelFa}</td>
                <td className="px-3 py-2 text-left">{r.wasteSum.toLocaleString("fa-IR")}</td>
                <td className="px-3 py-2 text-left">{r.rawSum.toLocaleString("fa-IR")}</td>
                <td className="px-3 py-2 text-left font-semibold">
                  {grandRaw > 0 && r.rawSum > 0 ? r.pct.toFixed(2) : "-"}{grandRaw > 0 && r.rawSum > 0 ? "٪" : ""}
                </td>
              </tr>
            ))}
            <tr>
              <td className="px-3 py-2 font-semibold">جمع روز</td>
              <td className="px-3 py-2 text-left  font-semibold">{grandWaste.toLocaleString("fa-IR")}</td>
              <td className="px-3 py-2 text-left  font-semibold">{grandRaw.toLocaleString("fa-IR")}</td>
              <td className="px-3 py-2 text-left  font-semibold">
                {grandRaw > 0 ? ((grandWaste / grandRaw) * 100).toFixed(2) : "-"}{grandRaw > 0 ? "٪" : ""}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
