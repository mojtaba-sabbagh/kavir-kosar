// app/(protected)/reports/daily-production/components/PauseDetailsSection.tsx
import { prisma } from "@/lib/db";
import { headers, cookies } from "next/headers";
import { unstable_noStore as noStore } from "next/cache";

type ProductKey = "1" | "2";
type Props = { date: string; product: ProductKey };

/* ----------------- tiny utils ----------------- */
function pick<T = any>(o: any, keys: string[], def?: any): T | undefined {
  for (const k of keys) {
    const val = k.split(".").reduce((acc: any, kk) => (acc ? acc[kk] : undefined), o);
    if (val !== undefined && val !== null && val !== "") return val as T;
  }
  return def;
}
function isHHMM(s?: string): boolean {
  return !!s && /^\d{1,2}:\d{2}$/.test(s);
}
function parseDateTime(dateISO: string, val?: string): Date | null {
  if (!val) return null;
  if (isHHMM(val)) return new Date(`${dateISO}T${val}:00`);
  const d = new Date(val);
  return isNaN(+d) ? null : d;
}
function formatTimeOnly(val?: string): string {
  if (!val) return "—";
  if (isHHMM(val)) return val;
  const d = new Date(val);
  return isNaN(+d)
    ? "—"
    : d.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
}
function diffMinutes(dateISO: string, start?: string, end?: string): number {
  const s = parseDateTime(dateISO, start);
  const e = parseDateTime(dateISO, end);
  if (!s || !e) return 0;
  let m = Math.round((+e - +s) / 60000);
  if (m < 0) m += 24 * 60; // across midnight
  return m;
}
function minToHHMM(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/* ------------- FixedInformation lookup (pause tableSelect) ------------- */
async function fetchFixedTitles(codes: string[]): Promise<Map<string, string>> {
  noStore();
  const map = new Map<string, string>();
  const cleaned = Array.from(
    new Set((codes || []).map((c) => String(c).trim()).filter((c) => c))
  ).slice(0, 300); // accept any non-empty code
  if (!cleaned.length) return map;

  const h = await headers();
  const ck = await cookies();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const base = process.env.NEXT_PUBLIC_APP_URL || (host ? `${proto}://${host}` : "");
  const cookieHeader = ck.getAll().map((c) => `${c.name}=${c.value}`).join("; ");

  const params = new URLSearchParams();
  params.set("codes", cleaned.join(","));
  const url = `${base}/api/lookups/fixed?${params.toString()}`;

  try {
    const r = await fetch(url, {
      headers: { cookie: cookieHeader, accept: "application/json" },
      cache: "no-store",
      next: { revalidate: 0 },
    });
    const items: any[] = r.ok ? (await r.json().catch(() => null))?.items ?? [] : [];
    for (const it of items) {
      const code = String(it?.code ?? "");
      const title = it?.title ?? it?.titleFa ?? it?.nameFa ?? it?.name ?? it?.label ?? "";
      if (code) map.set(code, title ? String(title) : code);
    }
    for (const c of cleaned) if (!map.has(c)) map.set(c, c);
  } catch {
    for (const c of cleaned) map.set(c, c);
  }
  return map;
}

/* ---------------- form + fields (to get select options) ---------------- */
async function getForm102500WithFields() {
  const form = await prisma.form.findFirst({
    where: { code: "102500" },
    select: {
      id: true,
      fields: { select: { key: true, type: true, config: true } },
    },
  });
  return form;
}
function parseConfig(cfg: unknown): any {
  if (!cfg) return {};
  if (typeof cfg === "string") {
    try {
      return JSON.parse(cfg);
    } catch {
      return {};
    }
  }
  return cfg as any;
}

/* -------------------- entries by payload.date AND product line -------------------- */
async function getPauseEntriesByDateAndProduct(formId: string, date: string, product: ProductKey) {
  // line may be stored as string "1"/"2" OR number 1/2; also there may be legacy keys
  const lineFilters = [
    { payload: { path: ["line"], equals: product } },
    { payload: { path: ["line"], equals: Number(product) } },
    { payload: { path: ["lineNo"], equals: product } },
    { payload: { path: ["lineNo"], equals: Number(product) } },
    { payload: { path: ["line_no"], equals: product } },
    { payload: { path: ["line_no"], equals: Number(product) } },
    { payload: { path: ["productionLine"], equals: product } },
    { payload: { path: ["productionLine"], equals: Number(product) } },
    { payload: { path: ["payload", "line"], equals: product } },
    { payload: { path: ["payload", "line"], equals: Number(product) } },
  ];

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
        { OR: lineFilters },
      ],
    },
    select: { id: true, payload: true },
    orderBy: { id: "asc" },
  });
}

export default async function PauseDetailsSection({ date, product }: Props) {
  // 1) load form and its fields (to map select values -> labels)
  const form = await getForm102500WithFields();
  if (!form?.id) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 text-gray-700">
        فرم 102500 یافت نشد.
      </div>
    );
  }

  // Build select options map: key -> (value -> label)
  const selectMaps: Record<string, Record<string, string>> = {};
  for (const f of form.fields ?? []) {
    if (f.type === "select") {
      const cfg = parseConfig(f.config);
      const opts: Array<{ value: any; label: any }> = Array.isArray(cfg?.options) ? cfg.options : [];
      const map: Record<string, string> = {};
      for (const o of opts) {
        const val = o?.value;
        if (val !== undefined && val !== null) map[String(val)] = String(o?.label ?? val);
      }
      selectMaps[f.key] = map;
    }
  }

  // Helper to map select field value -> label using the form's options
  const selectLabel = (payload: any, keys: string[]): string | undefined => {
    for (const key of keys) {
      const raw = payload?.[key];
      if (raw == null || raw === "") continue;

      const val =
        typeof raw === "object" && raw !== null
          ? raw.value ?? raw.code ?? raw.id ?? raw.label ?? ""
          : raw;
      const str = String(val ?? "");

      // 1) prefer label from options of the SAME key
      const fromSame = selectMaps[key]?.[str];
      if (fromSame) return fromSame;

      // 2) if payload already contains a label (rare), use it
      if (typeof raw === "object" && raw?.label) return String(raw.label);

      // 3) fallback: search other select maps for the same value
      for (const k in selectMaps) if (selectMaps[k]?.[str]) return selectMaps[k][str];

      // 4) last resort: show value
      return str;
    }
    return undefined;
  };

  // 2) fetch entries for the day & product line (server-side filtered)
  const entries = await getPauseEntriesByDateAndProduct(form.id, date, product);

  type Row = {
    pauseCode?: string;
    pauseTitle: string;
    cause?: string; // select label
    start?: string;
    end?: string;
    minutes: number;
  };

  // 3) gather rows + codes to resolve for pause (tableSelect)
  const codes = new Set<string>();
  const draft: Row[] = [];

  for (const e of entries) {
    const v = (e.payload ?? {}) as any;

    // pause (tableSelect) — may be string code or object {code,value,id,title,label,...}
    const pauseRaw = v?.pause ?? v?.pouse ?? v?.pauseCode ?? v?.pause_code;
    let pauseCode: string | undefined;
    let pauseLabel: string | undefined;
    if (pauseRaw && typeof pauseRaw === "object") {
      pauseCode = String(pauseRaw.code ?? pauseRaw.value ?? pauseRaw.id ?? "");
      pauseLabel = String(
        pauseRaw.title ?? pauseRaw.label ?? pauseRaw.titleFa ?? pauseRaw.nameFa ?? pauseRaw.name ?? ""
      );
    } else if (typeof pauseRaw === "string") {
      pauseCode = pauseRaw;
    }

    // pouse_cause (select) — map using the form's options (handle legacy variants)
    const cause = selectLabel(v, ["pouse_cause", "pause_cause", "cause"]);

    const start = pick<string>(v, ["start", "شروع"]);
    const end = pick<string>(v, ["end", "پایان"]);
    const dateISO = v?.date ?? v?.payloadDate ?? v?.tarikh ?? v?.payload?.date ?? date;

    const minutes = diffMinutes(String(dateISO), start, end);

    if (pauseCode) codes.add(pauseCode);
    draft.push({
      pauseCode,
      pauseTitle: pauseLabel || (pauseCode ? String(pauseCode) : "—"),
      cause,
      start,
      end,
      minutes,
    });
  }

  if (!draft.length) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 text-gray-700">
        برای تاریخ انتخاب‌شده، رکوردی از «توقفات و تعمیرات» یافت نشد.
      </div>
    );
  }

  // 4) resolve pause titles by code (FixedInformation)
  const titleMap = await fetchFixedTitles(Array.from(codes));
  const rows = draft.map((r) => ({
    ...r,
    pauseTitle:
      (r.pauseCode && titleMap.get(r.pauseCode)) || r.pauseTitle || (r.pauseCode ?? "—"),
  }));

  // 5) total duration
  const totalMin = rows.reduce((s, r) => s + (r.minutes || 0), 0);

  // 6) render
  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-4 py-3 font-semibold text-gray-900">
        توقفات و تعمیرات
      </div>
      <div className="overflow-x-auto p-4">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-white">
            <tr>
              <th className="px-3 py-2 text-right text-sm font-medium text-gray-900">#</th>
              <th className="px-3 py-2 text-right text-sm font-medium text-gray-900">شرح</th>
              <th className="px-3 py-2 text-right text-sm font-medium text-gray-900">توقف توسط</th>
              <th className="px-3 py-2 text-right text-sm font-medium text-gray-900">شروع</th>
              <th className="px-3 py-2 text-right text-sm font-medium text-gray-900">پایان</th>
              <th className="px-3 py-2 text-left  text-sm font-medium text-gray-900">مدت زمان</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {rows.map((r, idx) => (
              <tr key={idx}>
                <td className="px-3 py-2 whitespace-nowrap">{idx + 1}</td>
                <td className="px-3 py-2">{r.pauseTitle}</td>
                <td className="px-3 py-2">{r.cause ?? "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap">{formatTimeOnly(r.start)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{formatTimeOnly(r.end)}</td>
                <td className="px-3 py-2 text-left font-medium">{minToHHMM(r.minutes)}</td>
              </tr>
            ))}
            <tr>
              <td className="px-3 py-2 font-semibold text-gray-900" colSpan={5}>
                جمع مدت زمان
              </td>
              <td className="px-3 py-2 text-left font-semibold text-gray-900">
                {minToHHMM(totalMin)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
