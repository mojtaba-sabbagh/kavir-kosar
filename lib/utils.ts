// Persian labels for booleans (accepts true/false, "true"/"false", 1/0)
// @/lib/utils.ts

export function boolFa(v: any) {
  const t = typeof v;
  if (v == null) return '';                 // keep empty for null/undefined
  if (t === 'boolean') return v ? 'بله' : 'خیر';
  if (t === 'number')  return v === 1 ? 'بله' : v === 0 ? 'خیر' : String(v);
  if (t === 'string')  return v.toLowerCase() === 'true' || v === '1' ? 'بله' :
                               v.toLowerCase() === 'false' || v === '0' ? 'خیر' : v;
  return String(v);
}
