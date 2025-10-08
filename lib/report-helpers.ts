// /lib/report-helpers.ts (or @/lib/report-helpers)

export type ProductKey = "1" | "2";

/* ---------------- tiny value helpers ---------------- */
export function pick<T = any>(o: any, keys: string[], def?: any): T | undefined {
  for (const k of keys) {
    const v = k.split(".").reduce((acc: any, kk) => (acc ? acc[kk] : undefined), o);
    if (v !== undefined && v !== null && v !== "") return v as T;
  }
  return def;
}
export function codeFromAny(v: any): string {
  if (v == null) return "";
  if (typeof v === "object") {
    const raw = v.code ?? v.value ?? v.id ?? v.key ?? v.kardexCode ?? v.itemCode;
    return raw ? String(raw) : "";
  }
  return String(v);
}
export function amountOf(v: any): number {
  const n = Number(v?.amount ?? v?.qty ?? v?.مقدار ?? v?.تعداد ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/* ---------------- time helpers ---------------- */
export function isHHMM(s?: string): boolean {
  return !!s && /^\d{1,2}:\d{2}$/.test(s);
}
export function parseDateTime(dateISO: string, val?: string): Date | null {
  if (!val) return null;
  if (isHHMM(val)) return new Date(`${dateISO}T${val}:00`);
  const d = new Date(val);
  return isNaN(+d) ? null : d;
}
export function formatTimeOnly(val?: string): string {
  if (!val) return "—";
  if (isHHMM(val)) return val;
  const d = new Date(val);
  return isNaN(+d) ? "—" : d.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
}
export function diffMinutes(dateISO: string, start?: string, end?: string): number {
  const s = parseDateTime(dateISO, start);
  const e = parseDateTime(dateISO, end);
  if (!s || !e) return 0;
  let m = Math.round((+e - +s) / 60000);
  if (m < 0) m += 24 * 60; // across midnight
  return m;
}
export function minToHHMM(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/* ---------------- code matching helpers ---------------- */
export function patternToRegex(p: string): RegExp {
  // Treat * as a single digit wildcard
  return new RegExp("^" + p.replace(/\*/g, "\\d") + "$");
}
export function matchesByPrefixesOrPatterns(
  code: string,
  prefixes?: string[],
  patterns?: string[]
): boolean {
  if (!code) return false;
  if (prefixes?.some((p) => code.startsWith(p))) return true;
  if (patterns?.some((p) => patternToRegex(p).test(code))) return true;
  return false;
}

/* ---------------- Prisma JSON where builders ---------------- */
export const jsonDateWhere = (date: string) => ({
  OR: [
    { payload: { path: ["date"], equals: date } },
    { payload: { path: ["payloadDate"], equals: date } },
    { payload: { path: ["tarikh"], equals: date } },
    { payload: { path: ["payload", "date"], equals: date } },
  ],
});

export const jsonLineWhere = (product: ProductKey) => ({
  OR: [
    { payload: { path: ["line"], equals: product } },
    { payload: { path: ["payload", "line"], equals: product } },
  ],
});
