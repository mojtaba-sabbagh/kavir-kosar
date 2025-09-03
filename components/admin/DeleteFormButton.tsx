'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function DeleteFormButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const onDelete = async () => {
    if (!confirm('آیا از حذف این فرم مطمئن هستید؟')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/forms/${id}`, { method: 'DELETE' });
      if (res.ok) {
        router.refresh(); // reload list
      } else {
        const j = await res.json().catch(() => ({}));
        alert(j.message || 'خطا در حذف فرم');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={onDelete}
      disabled={busy}
      className="rounded-md border px-3 py-1 text-red-600 hover:bg-red-50 disabled:opacity-50"
      title="حذف فرم"
    >
      {busy ? 'در حال حذف…' : 'حذف'}
    </button>
  );
}
