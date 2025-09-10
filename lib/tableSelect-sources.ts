// lib/tableSelect-sources.ts
/**
 * Map query `table` to a *quoted* SQL identifier.
 * We normalize the incoming value to avoid casing/underscore issues.
 */
export function resolveTable(name?: string): string | null {
  const n = (name ?? 'fixedInformation').trim().toLowerCase();
  // Accept several aliases
  if (
    n === 'fixedinformation' ||
    n === 'fixed_information' ||
    n === 'fixed-info' ||
    n === 'fixtures' ||
    n === 'fixture' ||
    n === 'fixed' ||
    n === 'fixedinfo'
  ) {
    // IMPORTANT: double-quoted to match the actual table as created by Prisma
    return `"FixedInformation"`;
  }
  // Also allow the canonical camelCase used in configs
  if (n === 'fixedinformation' || n === 'fixedinformation') {
    return `"FixedInformation"`;
  }
  return `"FixedInformation"`; // <- safest default; or return null if you want explicit
}
