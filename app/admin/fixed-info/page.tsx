import FixedInfoManager from '@/components/admin/FixedInfoManager';

export const dynamic = 'force-dynamic';

export default function FixedInfoPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">اطلاعات ثابت</h1>
      <FixedInfoManager />
    </div>
  );
}
