import { NextResponse } from 'next/server';
import { getMyPendingCounts } from '@/lib/confirm';

export const dynamic = 'force-dynamic';

export async function GET() {
  const data = await getMyPendingCounts();
  return NextResponse.json(data);
}
