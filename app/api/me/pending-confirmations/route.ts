import { NextResponse } from 'next/server';
import { getMyPendingList } from '@/lib/confirm';

export const dynamic = 'force-dynamic';

export async function GET() {
  const items = await getMyPendingList(100);
  return NextResponse.json({ items });
}
