// app/(protected)/reports/daily-production/components/ReportFilterForm.tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useMemo, useTransition } from 'react';
import JDatePicker from '@/components/ui/JDatePicker';

type Props = {
  initialDate?: string;
  initialHours?: number;
  initialProduct?: string | number; // "1" | "2"
};

export default function ReportFilterForm({
  initialDate,
  initialHours = 24,
  initialProduct = '1',
}: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // pull current QS (so refreshes/bookmarks keep values)
  const dateFromQS = sp.get('date') || undefined;
  const hoursFromQS = sp.get('hours') || undefined;
  const productFromQS = sp.get('product') || undefined;

  // local state
  const [date, setDate] = useState<string | null>(dateFromQS ?? initialDate ?? null);
  const [hours, setHours] = useState<string>(String(hoursFromQS ?? initialHours ?? 24));
  const [product, setProduct] = useState<string>(String(productFromQS ?? initialProduct ?? '1'));

  const submitDisabled = useMemo(() => !date || !hours, [date, hours]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date) return;

    const qs = new URLSearchParams();
    qs.set('date', date);
    qs.set('hours', String(Math.max(1, Number(hours) || 24)));
    qs.set('product', product);

    startTransition(() => {
      router.push(`/reports/daily-production?${qs.toString()}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="mb-6">
      <div className="rounded-2xl border bg-white shadow-sm p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Date */}
          <div className="flex flex-col">
            <label className="mb-1 text-sm font-medium text-gray-700">تاریخ</label>
            <div dir="ltr" className="w-full">
              <JDatePicker value={date} onChange={(iso: string | null) => setDate(iso)} />
            </div>
          </div>

          {/* Hours */}
          <div className="flex flex-col">
            <label className="mb-1 text-sm font-medium text-gray-700">ساعات کاری</label>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={24}
              className="w-full rounded-md border px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              dir="ltr"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
          </div>

          {/* Product (merged ProductFilter) */}
          <div className="flex flex-col">
            <label className="mb-1 text-sm font-medium text-gray-700">نوع محصول</label>
            <select
              className="w-full rounded-md border px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              value={product}
              onChange={(e) => setProduct(e.target.value)}
            >
              <option value="1">چیپس</option>
              <option value="2">پاپکورن</option>
            </select>
          </div>

          {/* Submit */}
          <div className="flex items-end">
            <button
              type="submit"
              disabled={submitDisabled || isPending}
              className="w-full md:w-auto rounded-md bg-blue-600 text-white px-4 py-2 text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending ? 'در حال بارگذاری…' : 'نمایش گزارش'}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
