// lib/reports-guard.ts
import { NextResponse } from 'next/server';
import { canReadReport } from './reports';

export async function requireReportView(code: string) {
  // accept any case — the helper is already case-insensitive
  const ok = await canReadReport(code);
  if (!ok) {
    const err: any = new Error('FORBIDDEN');
    err.status = 403;
    throw err;
  }
}
