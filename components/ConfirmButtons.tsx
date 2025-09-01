'use client';

import { useState } from 'react';

export default function ConfirmButtons({
  entryId,
  task, // { isFinal: boolean, status: 'pending' | 'approved' | 'superseded' }
  allowed, // boolean from server (does the user have permission)
}: {
  entryId: string;
  task: { isFinal: boolean; status: string } | null;
  allowed: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!allowed || !task || task.status !== 'pending') return null;

  const label = task.isFinal ? 'تأیید نهایی' : 'تأیید';

  const onConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/forms/${entryId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        setDone(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.message || 'خطا در ثبت تأیید');
      }
    } catch (e) {
      setError('خطای شبکه');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="mt-4 text-green-600 font-semibold">
        {task.isFinal ? 'تأیید نهایی انجام شد' : 'تأیید شما ثبت شد'}
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-2">
      {error && <div className="text-red-600 text-sm">{error}</div>}
      <button
        onClick={onConfirm}
        disabled={loading}
        className="rounded-md bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'در حال ارسال…' : label}
      </button>
    </div>
  );
}
