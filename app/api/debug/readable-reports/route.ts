import { NextResponse } from 'next/server';
import { listReadableReports } from '@/lib/reports';

export async function GET() {
  const reports = await listReadableReports();
  return NextResponse.json({ count: reports.length, reports });
}
