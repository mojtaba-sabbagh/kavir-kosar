import { NextResponse } from 'next/server';
import { listReadableReports } from '@/lib/reports';
import { getSession } from '@/lib/auth';

export async function GET() {
  const user = await getSession();
  if (!user?.id) {
    return NextResponse.json({ ok: false, message: 'UNAUTHORIZED' }, { status: 401 });
  }

  const reports = await listReadableReports(user.id);
  return NextResponse.json({ ok: true, count: reports.length, reports });
}
