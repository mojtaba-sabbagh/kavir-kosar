// app/api/entries/search/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { formatJalali } from '@/lib/date-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Helper function similar to your renderer
function resolveFieldValue(value: any, fieldType: string, fieldConfig?: any, displayMaps?: any): string {
  if (value == null || value === '') return '';
  
  const valueStr = String(value);
  
  // checkbox/boolean
  if (fieldType === 'checkbox') {
    return value === true || value === 'true' || value === 1 ? 'بله' : 'خیر';
  }
  
  // date/datetime
  if (fieldType === 'date' && value) return formatJalali(value, false);
  if (fieldType === 'datetime' && value) return formatJalali(value, true);
  
  // select - get label from options
  if (fieldType === 'select') {
    const options = fieldConfig?.options || [];
    const option = options.find((opt: any) => String(opt.value) === valueStr);
    return option?.label || valueStr;
  }
  
  // multiselect
  if (fieldType === 'multiselect' && Array.isArray(value)) {
    const options = fieldConfig?.options || [];
    return value.map(v => {
      const option = options.find((opt: any) => String(opt.value) === String(v));
      return option?.label || String(v);
    }).join('، ');
  }
  
  // tableSelect, kardexItem - use display maps
  if (fieldType === 'tableSelect' || fieldType === 'kardexItem') {
    // Try to find the label in display maps
    const label = displayMaps?.[valueStr];
    
    // Return the label if found and different from value
    if (label && label !== valueStr) {
      return label;
    }
    
    // If no label found, show the code
    return valueStr;
  }
  
  // For all other types, return string value
  return valueStr;
}

// Type to represent the payload structure
interface FormEntryPayload {
  [key: string]: any;
}

// Helper to safely get value from payload
function getPayloadValue(payload: any, field: string): any {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return (payload as FormEntryPayload)[field];
  }
  return undefined;
}

export async function GET(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim();
  const codes = (url.searchParams.getAll('code') || []).filter(Boolean);
  const fields = url.searchParams.getAll('fields');
  const resolveRefs = url.searchParams.get('resolveRefs') === 'true';
  
  const requestedFields = fields.length > 0 ? fields : ['titleFa'];

  // Find forms the user can read
  const readable = await prisma.roleFormPermission.findMany({
    where: {
      canRead: true,
      role: { users: { some: { userId: user.id } } },
      ...(codes.length ? { form: { code: { in: codes } } } : {}),
    },
    select: { 
      formId: true, 
      form: { 
        select: { 
          code: true, 
          titleFa: true,
          fields: {
            select: {
              key: true,
              type: true,
              config: true,
            }
          }
        } 
      } 
    },
  });

  const formIds = readable.map(r => r.formId);
  if (formIds.length === 0) return NextResponse.json({ items: [] });

  const byFormId = Object.fromEntries(
    readable.map(r => [r.formId, { 
      code: r.form.code, 
      titleFa: r.form.titleFa,
      fields: r.form.fields 
    }])
  );

  // Build where clause
  const where: any = { formId: { in: formIds } };
  
  if (q) {
    where.OR = requestedFields.map(field => ({
      payload: {
        path: [field],
        string_contains: q,
        mode: 'insensitive'
      }
    }));
    
    where.OR.push({
      id: {
        contains: q,
        mode: 'insensitive'
      }
    });
  }

  const entries = await prisma.formEntry.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      formId: true,
      payload: true,
      createdAt: true,
    },
  });

  // Pre-fetch display maps for tableSelect and kardexItem fields
  const displayMaps: Record<string, Record<string, string>> = {};
  
  // Get all unique kardexItem codes from entries
  const kardexCodes = new Set<string>();
  const tableSelectCodes = new Set<string>();
  
  // First pass: collect all codes that need resolution
  entries.forEach(entry => {
    const formInfo = byFormId[entry.formId];
    const fieldDefs = formInfo?.fields || [];
    
    requestedFields.forEach(field => {
      const fieldDef = fieldDefs.find((f: any) => f.key === field);
      if (fieldDef) {
        // Safely access the payload field
        const value = getPayloadValue(entry.payload, field);
        if (value) {
          if (fieldDef.type === 'kardexItem') {
            kardexCodes.add(String(value));
          } else if (fieldDef.type === 'tableSelect') {
            tableSelectCodes.add(String(value));
          }
        }
      }
    });
  });

  // Fetch kardex items
  if (kardexCodes.size > 0) {
    const kardexItems = await prisma.kardexItem.findMany({
      where: { code: { in: Array.from(kardexCodes) } },
      select: { code: true, nameFa: true }
    });
    
    displayMaps.kardexItem = {};
    kardexItems.forEach(item => {
      displayMaps.kardexItem[item.code] = item.nameFa;
    });
  }

  // Fetch table select items (FixedInformation)
  if (tableSelectCodes.size > 0) {
    const fixedInfos = await prisma.fixedInformation.findMany({
      where: { code: { in: Array.from(tableSelectCodes) } },
      select: { code: true, title: true }
    });
    
    displayMaps.tableSelect = {};
    fixedInfos.forEach(info => {
      displayMaps.tableSelect[info.code] = info.title;
    });
  }

  // Process entries with proper field resolution
  const items = await Promise.all(entries.map(async (entry) => {
    const formInfo = byFormId[entry.formId];
    const item: any = {
      id: entry.id,
      formCode: formInfo?.code,
      formTitle: formInfo?.titleFa,
    };
    
    const fieldDefs = formInfo?.fields || [];
    const fieldMap = Object.fromEntries(fieldDefs.map((f: any) => [f.key, f]));
    
    // Extract and process requested fields
    for (const field of requestedFields) {
      const rawValue = getPayloadValue(entry.payload, field);
      
      const fieldDef = fieldMap[field];
      const fieldType = fieldDef?.type;
      const fieldConfig = fieldDef?.config || {};
      
      let resolvedValue = rawValue;
      
      if (resolveRefs && rawValue) {
        switch (fieldType) {
          case 'entryRef':
            // Resolve single entry reference
            const refEntry = await prisma.formEntry.findUnique({
              where: { id: rawValue },
              select: { payload: true }
            });
            if (refEntry?.payload) {
              const refValue = getPayloadValue(refEntry.payload, 'titleFa') || 
                              (requestedFields.length > 0 ? getPayloadValue(refEntry.payload, requestedFields[0]) : '') ||
                              rawValue;
              resolvedValue = refValue;
            }
            break;
            
          case 'entryRefMulti':
            // Resolve multiple entry references
            if (Array.isArray(rawValue)) {
              const refEntries = await prisma.formEntry.findMany({
                where: { id: { in: rawValue } },
                select: { payload: true }
              });
              
              const resolvedEntries = refEntries.map(e => {
                if (e.payload) {
                  return getPayloadValue(e.payload, 'titleFa') || 
                         (requestedFields.length > 0 ? getPayloadValue(e.payload, requestedFields[0]) : '') ||
                         'ورودی';
                }
                return 'ورودی';
              }).filter(Boolean);
              
              resolvedValue = resolvedEntries.length > 0 
                ? resolvedEntries.join('، ')
                : rawValue.join('، ');
            }
            break;
            
          case 'kardexItem':
            resolvedValue = displayMaps.kardexItem?.[rawValue] || rawValue;
            break;
            
          case 'tableSelect':
            resolvedValue = displayMaps.tableSelect?.[rawValue] || rawValue;
            break;
            
          default:
            // For other types, use the resolveFieldValue function
            resolvedValue = resolveFieldValue(rawValue, fieldType || 'text', fieldConfig, {
              ...displayMaps.kardexItem,
              ...displayMaps.tableSelect
            });
        }
      } else if (rawValue !== undefined) {
        // Even if not resolving refs, still format basic types
        resolvedValue = resolveFieldValue(rawValue, fieldType || 'text', fieldConfig, {
          ...displayMaps.kardexItem,
          ...displayMaps.tableSelect
        });
      } else {
        resolvedValue = '';
      }
      
      item[field] = resolvedValue;
      
      // Also include raw value and field info for client-side
      if (resolveRefs) {
        if (!item._raw) item._raw = {};
        item._raw[field] = rawValue;
        
        if (!item._fieldInfo) item._fieldInfo = {};
        item._fieldInfo[field] = {
          type: fieldType,
          config: fieldConfig
        };
      }
    }
    
    return item;
  }));

  return NextResponse.json({ items });
}