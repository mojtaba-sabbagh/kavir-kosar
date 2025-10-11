import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type ProductKey = "1" | "2";
type Props = { date: string; product?: ProductKey };

/* ---------- helpers ---------- */
function faToEnDigits(s: any): string {
  const str = String(s ?? "");
  const map: Record<string, string> = {
    "۰":"0","۱":"1","۲":"2","۳":"3","۴":"4","۵":"5","۶":"6","۷":"7","۸":"8","۹":"9",
    "٠":"0","١":"1","٢":"2","٣":"3","٤":"4","٥":"5","٦":"6","٧":"7","٨":"8","٩":"9",
  };
  return str.replace(/[0-9۰-۹٠-٩]/g, (ch) => map[ch] ?? ch);
}
function cleanCode(input: any): string | undefined {
  const s = faToEnDigits(input);
  const digits = s.replace(/[^\d]/g, "");
  return digits || undefined;
}
function parseNumber(v: any): number {
  if (v == null || v === "") return NaN;
  return typeof v === "string" ? parseFloat(faToEnDigits(v).replace(/,/g, "")) : Number(v);
}
function parseAmount(v: any): number {
  const n = parseNumber(v);
  return Number.isFinite(n) ? n : 0;
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
function isSourceOne(v: any): boolean {
  const n = Number(faToEnDigits(v));
  return n === 1;
}
function toJalali(isoDate: string, latn = false): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return isoDate;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
  try {
    return new Intl.DateTimeFormat(
      latn ? "fa-IR-u-ca-persian-nu-latn" : "fa-IR-u-ca-persian",
      { year: "numeric", month: "2-digit", day: "2-digit" }
    ).format(d);
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

/** Extract product codes + amounts from payload (supports raw_material or product fields). */
function extractProducts(p: any): { code: string; amount: number }[] {
  const amountTop = parseAmount(p?.amount ?? p?.qty ?? p?.quantity ?? p?.count ?? p?.value);

  // Prefer raw_material if present (single code or structure)
  const raw = p?.raw_material ?? p?.rawMaterial;
  if (typeof raw === "string" || typeof raw === "number") {
    const code = cleanCode(raw);
    return code && amountTop !== 0 ? [{ code, amount: amountTop }] : [];
  }
  if (Array.isArray(raw)) {
    const out: { code: string; amount: number }[] = [];
    for (const r of raw) {
      const code = cleanCode(
        r?.code ?? r?.kardexCode ?? r?.itemCode ?? r?.kardex?.code ?? r?.item?.code ?? r?.name
      );
      const a = parseAmount(r?.amount ?? r?.qty ?? r?.quantity ?? r?.count ?? amountTop);
      if (code && a !== 0) out.push({ code, amount: a });
    }
    if (out.length) return out;
  }
  if (raw && typeof raw === "object") {
    const out: { code: string; amount: number }[] = [];
    for (const [k, v] of Object.entries(raw)) {
      const code = cleanCode(k);
      const a = parseAmount(v);
      if (code && a !== 0) out.push({ code, amount: a });
    }
    if (out.length) return out;
  }

  // Fallback: product / products
  const prod = p?.product ?? p?.products;
  if (typeof prod === "string" || typeof prod === "number") {
    const code = cleanCode(prod);
    return code && amountTop !== 0 ? [{ code, amount: amountTop }] : [];
  }
  if (Array.isArray(prod)) {
    const out: { code: string; amount: number }[] = [];
    for (const r of prod) {
      const code = cleanCode(
        r?.code ?? r?.kardexCode ?? r?.itemCode ?? r?.kardex?.code ?? r?.item?.code ?? r?.name
      );
      const a = parseAmount(r?.amount ?? r?.qty ?? r?.quantity ?? r?.count ?? amountTop);
      if (code && a !== 0) out.push({ code, amount: a });
    }
    return out;
  }
  if (prod && typeof prod === "object") {
    return Object.entries(prod).map(([k, v]) => ({
      code: cleanCode(k)!,
      amount: parseAmount(v),
    }));
  }

  return [];
}

/* ---------- types ---------- */
type Row = {
  dateFa: string;            // Jalali of payload.date
  shift?: 1 | 2 | 3;
  unitCode?: string | null;  // payload.unit (for FixedInformation lookup)
  unitName?: string | null;  // FixedInformation.title
  code: string;              // product code
  nameFa?: string | null;    // KardexItem.nameFa
  amount: number;
  weight: number;            // amount * (KardexItem.extra.weight)
  note?: string | null;
};

export default async function ProductsDetailsSection({ date, product = "1" }: Props) {
  // fetch entries for the day, finalConfirmed — NOTE: product form is 1031000
  const entries = await prisma.formEntry.findMany({
    where: {
      form: { code: "1031000" },
      status: "finalConfirmed",
      payload: { path: ["date"], equals: date },
    },
    select: { id: true, payload: true },
    orderBy: { id: "asc" },
  });

  const rows: Row[] = [];
  const codes = new Set<string>();
  const unitCodes = new Set<string>();

  const prefix = product === "1" ? "41" : "42";

  for (const e of entries) {
    const p = (e.payload as any) ?? {};
    if (!isSourceOne(p?.source)) continue;

    const shift = parseShift(p?.shift);
    const unitCode = p?.unit ?? null;
    if (unitCode) unitCodes.add(String(unitCode));

    const payloadDate = normalizeIsoDateLike(p?.date) || date;
    const dateFa = toJalali(payloadDate);

    const prods = extractProducts(p).filter((it) => it.code.startsWith(prefix));
    for (const it of prods) {
      codes.add(it.code);
      rows.push({
        dateFa,
        shift,
        unitCode,
        unitName: null,
        code: it.code,
        nameFa: null,
        amount: it.amount,
        weight: 0, // fill after kardex lookup
        note: p?.description ?? null,
      });
    }
  }

  // 1) Names + per-unit weight from KardexItem.extra.weight
  if (codes.size) {
    const items = await prisma.kardexItem.findMany({
      where: { code: { in: [...codes] } },
      select: { code: true, nameFa: true, extra: true },
    });

    const itemMap = new Map(items.map((i) => [i.code, i]));
    for (const r of rows) {
      const it = itemMap.get(r.code);
      if (it) {
        r.nameFa = it.nameFa ?? r.nameFa ?? null;

        // robust read of per-unit weight
        let perUnitWeight = 0;
        const ex: any = (it as any).extra;
        if (ex && typeof ex === "object" && "weight" in ex) {
          perUnitWeight = parseNumber(ex.weight);
        }
        r.weight = r.amount * (Number.isFinite(perUnitWeight) ? perUnitWeight : 0);
      }
    }
  }

  // 2) Unit names from FixedInformation (code -> title)
  if (unitCodes.size) {
    const units = await prisma.fixedInformation.findMany({
      where: { code: { in: [...unitCodes] } },
      select: { code: true, title: true },
    });
    const unitMap = new Map(units.map((u) => [String(u.code), u.title]));
    for (const r of rows) {
      if (r.unitCode) r.unitName = unitMap.get(String(r.unitCode)) ?? String(r.unitCode);
    }
  }

  const nf = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 3 });

  // group by code for display (each product gets its own table)
  const byCode = new Map<string, Row[]>();
  for (const r of rows) {
    if (!byCode.has(r.code)) byCode.set(r.code, []);
    byCode.get(r.code)!.push(r);
  }

  const present = [...byCode.entries()].map(([code, rs]) => {
    const nameFa = rs[0]?.nameFa ?? "";
    const totalAmount = rs.reduce((s, x) => s + x.amount, 0);
    const totalWeight = rs.reduce((s, x) => s + x.weight, 0);
    return { code, nameFa, rows: rs, totalAmount, totalWeight };
  });

  return (
    <section className="w-full">
      <h2 className="text-xl font-bold mb-3">
        جزئیات تولید
      </h2>

      {present.length === 0 ? (
        <div className="text-sm text-gray-600 border rounded-lg p-3">
          برای این تاریخ، رکورد تولید یافت نشد.
        </div>
      ) : (
        <div className="space-y-6">
          {present.map((g) => (
            <div key={g.code} className="border rounded-lg">
              <div className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-t-lg">
                <div className="font-semibold">
                  {g.nameFa || "بدون نام"}{" "}
                  <span className="text-xs text-gray-500" dir="ltr">
                    ({g.code})
                  </span>
                </div>
                <div className="text-sm">
                  جمع تعداد: <span className="font-bold">{nf(g.totalAmount)}</span>
                  <span className="mx-2">|</span>
                  جمع وزن: <span className="font-bold">{nf(g.totalWeight)}</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-[1000px] w-full text-sm text-center">
                  <thead>
                    <tr className="bg-white">
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">تاریخ</th>
                      <th className="px-3 py-2">شیفت</th>
                      <th className="px-3 py-2">کد محصول</th>
                      <th className="px-3 py-2">نام محصول</th>
                      <th className="px-3 py-2">تعداد</th>
                      <th className="px-3 py-2">واحد</th>
                      <th className="px-3 py-2">وزن</th>
                      <th className="px-3 py-2">توضیحات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.rows.map((r, i) => (
                      <tr key={`${g.code}-${i}`} className="border-t">
                        <td className="px-3 py-2">{i + 1}</td>
                        <td className="px-3 py-2">{r.dateFa}</td>
                        <td className="px-3 py-2">{r.shift ?? ""}</td>
                        <td className="px-3 py-2" dir="ltr">{r.code}</td>
                        <td className="px-3 py-2">{r.nameFa ?? ""}</td>
                        <td className="px-3 py-2">{nf(r.amount)}</td>
                        <td className="px-3 py-2">{r.unitName ?? ""}</td>
                        <td className="px-3 py-2">{nf(r.weight)}</td>
                        <td className="px-3 py-2">{r.note ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-gray-50 font-semibold">
                      <td className="px-3 py-2" colSpan={6}>جمع</td>
                      <td className="px-3 py-2">{nf(g.totalAmount)}</td>
                      <td className="px-3 py-2">{nf(g.totalWeight)}</td>
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
