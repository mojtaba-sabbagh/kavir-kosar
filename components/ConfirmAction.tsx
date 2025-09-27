'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ConfirmAction({ entryId }: { entryId: string }) {
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  const confirm = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/forms/${entryId}/confirm`, { method: 'POST' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(j?.message || 'خطا در تایید');
      } else {
        setOk(true);
        // If you prefer to return to the list after confirm, uncomment:
        setTimeout(() => router.replace('/confirmations'), 700);
      }
    } catch (e) {
      setErr('خطای شبکه');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={confirm}
        disabled={busy || ok}
        className="rounded-md bg-blue-600 text-white px-4 py-2 disabled:opacity-50"
        aria-disabled={busy || ok}
      >
        {ok ? 'تایید شد' : busy ? '...' : 'تایید'}
      </button>

      {err && <span className="text-red-600 text-sm">{err}</span>}
    </div>
  );
}
