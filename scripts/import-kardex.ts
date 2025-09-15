/* scripts/import-kardex.ts */
import { PrismaClient } from '@prisma/client';
import XLSX from 'xlsx';
import path from 'path';

const prisma = new PrismaClient();

// UPDATED: Match the actual column names from your Excel file
const COLS = {
  code:        'codeKala',        // Changed from 'کد' to 'کد کالا'
  nameFa:      'nameKala',       // Changed from 'نام' to 'نام کالا'
  //category:    'گروه',           // This might not exist in your file
  //unit:        'واحد',           // This matches
  currentQty:  'qty',         // Using same as opening for now
  openingQty:  'openingQty',         // Changed from 'موجودی اول دوره' to 'موجودی'
  //openingValue:'ارزش اول دوره',  // This might not exist
  //currentValue:'ارزش فعلی',      // This might not exist
  storage: 'storage',
  orderPoint: 'orderPoint'  
};

function num(v: any) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[, ]/g, ''));
  return isFinite(n) ? n : null;
}

async function main() {
  const file = path.join(process.cwd(), 'sheet_data.xlsx');
  console.log(`Reading file: ${file}`);
  
  const wb = XLSX.readFile(file, { cellDates: true, raw: true, codepage: 65001 });
  console.log(`Sheets found: ${wb.SheetNames.join(', ')}`);
  
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });

  console.log(`Found ${rows.length} rows`);
  
  // Log available column names
  if (rows.length > 0) {
    console.log('Available columns:', Object.keys(rows[0]));
  }
  console.log(rows.slice(0, 3)); // Log first 3 rows for inspection
  const ops = [];
  let processed = 0;
  let skipped = 0;

  for (const r of rows) {
    const code = String(r[COLS.code] ?? '').trim();
    if (!code) {
      skipped++;
      continue;
    }

    // Create item with only available data
    const item = {
      code,
      nameFa: String(r[COLS.nameFa] ?? '').trim() || code,
      storage: r[COLS.storage] ? String(r[COLS.storage]).trim() : null,
      orderPoint: String(r[COLS.orderPoint] ?? '').trim() || null,
      openingQty: num(r[COLS.openingQty]),
      currentQty: num(r[COLS.currentQty]),
      extra: {},
    } as any;

    // Collect all other columns into extra
    for (const k of Object.keys(r)) {
      if (!Object.values(COLS).includes(k)) {
        item.extra[k] = r[k];
      }
    }

    ops.push(
      prisma.kardexItem.upsert({
        where: { code: item.code },
        update: item,
        create: item,
      })
    );
    processed++;
  }

  console.log(`Processed: ${processed}, Skipped: ${skipped}, Total operations: ${ops.length}`);

  if (ops.length === 0) {
    console.log('❌ No operations to perform. Check column mapping.');
    return;
  }

  // Run in batches
  const chunk = 100; // Smaller batch for safety
  for (let i = 0; i < ops.length; i += chunk) {
    try {
      const result = await prisma.$transaction(ops.slice(i, i + chunk));
      console.log(`Upserted batch ${i/chunk + 1}: ${result.length} items`);
    } catch (error) {
      console.error('Error in transaction:', error);
    }
  }

  console.log('✅ Import completed');
}

main()
  .catch((error) => {
    console.error('❌ Script failed:', error);
  })
  .finally(() => prisma.$disconnect());