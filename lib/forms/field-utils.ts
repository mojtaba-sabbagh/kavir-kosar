import type { FormField, FieldType } from '@prisma/client';

export function isLtrField(type: FieldType, key: string) {
  // numbers, date(time), and obvious ID/code fields render LTR
  return (
    type === 'number' ||
    type === 'date' ||
    type === 'datetime' ||
    key.toLowerCase().includes('code') ||
    key.toLowerCase().includes('id')
  );
}

export function optionLabel(opt: any) {
  // options config: { value, label }
  return (opt && (opt.label ?? opt.value)) ?? '';
}
