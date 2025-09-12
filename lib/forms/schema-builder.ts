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
        // Build constraints on a plain ZodNumber first
        let base = z.number();

        if (cfg && cfg.decimals !== true) {
            base = base.int();
        }
        if (cfg && typeof cfg.min === 'number') {
            base = base.min(cfg.min);
        }
        if (cfg && typeof cfg.max === 'number') {
            base = base.max(cfg.max);
        }

        // Then wrap with preprocess to handle "", null, etc. and string → number
        const coerced = z.preprocess(
            (v) => {
            if (v === '' || v == null) return undefined; // lets optional pass
            if (typeof v === 'string') return Number(v);
            return v;
            },
            base
        );

        shape[f.key] = f.required ? coerced : coerced.optional();
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
      case 'entryRef': {
        const base = z.preprocess(
        v => (v === '' || v == null ? undefined : v),
        z.string().uuid()
        );
        shape[f.key] = f.required ? base : base.optional();
        break;
      }
      case 'entryRefMulti': {
        // must be an array of UUID strings
        const base = z.array(z.string().uuid());
        // required: at least one; optional: allow missing/empty array
        shape[f.key] = f.required ? base.min(1) : base.optional().default([]);
        break;
      }
      case 'phone': {
        // Basic phone validation (any +digits, 3-32 chars)
        const p = z.string().min(3).max(32).regex(/^\+?[0-9\s\-()]+$/);
        shape[f.key] = f.required ? p : p.optional().transform(v => v ?? '');
        break;
      }
      default: {
        // Fallback: accept string
        const s = z.string().trim();
        shape[f.key] = f.required ? s.min(1) : s.optional();
      }
    }
  }

  return z.object(shape).strict();
}
