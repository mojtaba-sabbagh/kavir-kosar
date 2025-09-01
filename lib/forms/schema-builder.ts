import { z } from 'zod';
import type { FieldType, FormField } from '@prisma/client';

/**
 * Build a Zod object schema from FormField[].
 * - Respects required
 * - Coerces number/float
 * - Validates select/multiselect options
 * - Coerces checkbox to boolean
 * - date/datetime are strings (ISO) — keep server control
 */
export function buildZodSchema(fields: Pick<FormField,
  'key'|'type'|'required'|'config'
>[]) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const f of fields) {
    const cfg = (f.config ?? {}) as any;

    switch (f.type as FieldType) {
      case 'text': {
        let s = z.string().trim();
        if (cfg.minLength) s = s.min(cfg.minLength);
        if (cfg.maxLength) s = s.max(cfg.maxLength);
        if (cfg.regex) try { s = s.regex(new RegExp(cfg.regex)); } catch {}
        shape[f.key] = f.required ? s.min(1) : s.optional().transform(v => v ?? '');
        break;
      }
      case 'textarea': {
        let s = z.string().trim();
        if (cfg.minLength) s = s.min(cfg.minLength);
        if (cfg.maxLength) s = s.max(cfg.maxLength);
        shape[f.key] = f.required ? s.min(1) : s.optional().transform(v => v ?? '');
        break;
      }
      case 'number': {
        // Coerce strings like "12.34" to numbers
        let n = z.preprocess(v => (v === '' || v == null ? undefined : typeof v === 'string' ? Number(v) : v), z.number());
        if (cfg.decimals !== true) n = n.int();
        if (typeof cfg.min === 'number') n = n.min(cfg.min);
        if (typeof cfg.max === 'number') n = n.max(cfg.max);
        shape[f.key] = f.required ? n : n.optional();
        break;
      }
      case 'date': {
        // Keep as string (yyyy-mm-dd). Validate basic length.
        const d = z.string().min(4).max(32);
        shape[f.key] = f.required ? d : d.optional();
        break;
      }
      case 'datetime': {
        const dt = z.string().min(4).max(64);
        shape[f.key] = f.required ? dt : dt.optional();
        break;
      }
      case 'select': {
        const values = (cfg?.options ?? []).map((o: any) => String(o.value));
        const sel = values.length ? z.enum(values as [string, ...string[]]) : z.string().min(1);
        shape[f.key] = f.required ? sel : sel.optional();
        break;
      }
      case 'multiselect': {
        const values = (cfg?.options ?? []).map((o: any) => String(o.value));
        const arr = values.length
          ? z.array(z.enum(values as [string, ...string[]]))
          : z.array(z.string().min(1));
        let a = arr;
        if (typeof cfg.minItems === 'number') a = a.min(cfg.minItems);
        if (typeof cfg.maxItems === 'number') a = a.max(cfg.maxItems);
        shape[f.key] = f.required ? a : a.optional().default([]);
        break;
      }
      case 'checkbox': {
        const b = z.preprocess(v => (v === 'on' || v === true || v === 'true'), z.boolean());
        shape[f.key] = f.required ? b : b.optional().default(false);
        break;
      }
      case 'file': {
        // For now accept string storage key(s); real upload handled elsewhere
        const file = z.string().min(1);
        shape[f.key] = f.required ? file : file.optional();
        break;
      }
      default: {
        // Fallback: accept string
        const s = z.string().trim();
        shape[f.key] = f.required ? s.min(1) : s.optional();
      }
    }
  }

  return z.object(shape);
}
