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

function zodForAtomicField(f: any): z.ZodTypeAny {
  switch (f.type) {
    case 'text': return z.string().trim();
    case 'textarea': return z.string();
    case 'number': return z.preprocess(v => (v === '' ? undefined : Number(v)), z.number());
    case 'date': return z.string().regex(/^\d{4}-\d{2}-\d{2}/);
    case 'datetime': return z.string(); // ISO
    case 'select': return z.string();
    case 'multiselect': return z.array(z.string());
    case 'checkbox': return z.boolean();
    case 'file': return z.string(); // storage key
    case 'entryRef': return z.string().uuid();
    case 'entryRefMulti': return z.array(z.string().uuid());
    case 'kardexItem': return z.string();
    case 'tableSelect': return z.string();
    default: return z.any();
  }
}

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
      
      case 'subform': {
        // Subform is an array of objects (rows)
        // Each row is an object with fields, but we don't deeply validate here
        // Just accept it as an array of objects
        const base = z.array(z.record(z.string(), z.any()));
        shape[f.key] = f.required ? base.min(1) : base.optional().default([]);
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
