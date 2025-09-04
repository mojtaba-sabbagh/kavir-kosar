import { NextResponse } from 'next/server';
import { getMyPendingCounts, getMyPendingList } from '@/lib/confirm';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const me = await getSession();
  const counts = await getMyPendingCounts();
  const items = await getMyPendingList(50);
  return NextResponse.json({ me, counts, items });
}
