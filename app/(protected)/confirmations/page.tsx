import ConfirmationsClient from './client';
import { getMyPendingList } from '@/lib/confirm';

export const dynamic = 'force-dynamic';

export default async function ConfirmationsPage(props: { searchParams?: Promise<{ kind?: string }> }) {
  const { kind } = (await props.searchParams) ?? {};
  const items = await getMyPendingList(200);
  const filtered = kind ? items.filter(i => i.kind === kind) : items;
  const normalized = filtered.map(it => ({
    ...it,
    createdAt: it.createdAt ? it.createdAt.toISOString() : null,
  }));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">موارد در انتظار تایید</h1>
      <ConfirmationsClient items={normalized} />
    </div>
  );
}
