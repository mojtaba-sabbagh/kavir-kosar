// Minimal Persian text normalizer for search matching
export function normalizeFa(input: string): string {
  if (!input) return '';
  let s = input;

  try { s = s.normalize('NFKC'); } catch {}

  // Remove zero-width/diacritics
  s = s.replace(/[\u200B-\u200F\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, '');

  // Arabic -> Persian glyphs
  s = s
    .replace(/ي/g, 'ی') // Arabic Yeh -> Persian Yeh
    .replace(/ى/g, 'ی') // Alef Maqsura -> Persian Yeh
    .replace(/ك/g, 'ک'); // Arabic Kaf -> Persian Kaf

  // Arabic-Indic & Eastern Arabic digits -> ASCII
  const arabicIndic = '٠١٢٣٤٥٦٧٨٩';   // U+0660..U+0669
  const persianIndic = '۰۱۲۳۴۵۶۷۸۹';  // U+06F0..U+06F9
  s = s.replace(/[٠-٩۰-۹]/g, (ch) => {
    const i1 = arabicIndic.indexOf(ch);
    if (i1 >= 0) return String(i1);
    const i2 = persianIndic.indexOf(ch);
    if (i2 >= 0) return String(i2);
    return ch;
  });

  // Normalize whitespace
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}
