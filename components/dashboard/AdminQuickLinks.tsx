import Link from 'next/link';

export default function AdminQuickLinks() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {/* existing buttons … */}
      <Link href="/admin/fixed-info" className="block rounded-lg border p-4 hover:bg-gray-50">
        اطلاعات ثابت
      </Link>
    </div>
  );
}
