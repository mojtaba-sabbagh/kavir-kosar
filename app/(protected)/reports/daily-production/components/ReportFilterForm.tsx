// app/(protected)/reports/daily-production/components/ReportFilterForm.tsx
'use client';

import { useMemo, useState } from 'react';
import JDatePicker from '@/components/ui/JDatePicker';

type Props = {
  initialDate?: string; // YYYY-MM-DD (Gregorian)
  initialHours?: number;
};

function formatYYYYMMDDLocal(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function ReportFilterForm({ initialDate, initialHours = 24 }: Props) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => {
    if (!initialDate) return new Date();
    const [y, m, d] = initialDate.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  });
  const [hours, setHours] = useState<number>(initialHours);

  const submitDate = useMemo(
    () => (selectedDate ? formatYYYYMMDDLocal(selectedDate) : ''),
    [selectedDate]
  );

  return (
    <form method="GET" className="bg-white border rounded-xl p-4 md:p-5 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
      {/* Date (Jalali UI) */}
      <div>
        {/* Remove htmlFor since we’re not passing an id into JDatePicker */}
        <label className="block text-sm font-medium mb-1">
          تاریخ گزارش (جلالی)
        </label>

        {/* Force the input area to LTR visually */}
        <div dir="ltr">
          <JDatePicker
            value={selectedDate as any} // many implementations accept Date or string
            onChange={(val: any) => {
              if (val instanceof Date) {
                setSelectedDate(val);
              } else if (typeof val === 'string') {
                // If your JDatePicker returns a YYYY-MM-DD string (Jalali or Gregorian)
                const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(val);
                if (m) setSelectedDate(new Date(+m[1], +m[2] - 1, +m[3]));
                // If it returns a Jalali string like 1404-07-10, plug your converter here and set Date
              } else if (val && typeof val === 'object' && 'toDate' in val && typeof val.toDate === 'function') {
                // Some pickers return a moment-like object
                setSelectedDate((val as any).toDate());
              }
            }}
          />
        </div>

        {/* Hidden Gregorian date for the server */}
        <input type="hidden" name="date" value={submitDate} />
      </div>

      {/* Hours */}
      <div>
        <label htmlFor="hours" className="block text-sm font-medium mb-1">
          ساعات کار (مثلاً ۲۰)
        </label>
        <input
          id="hours"
          name="hours"
          type="number"
          min={1}
          step={1}
          value={Number.isFinite(hours) ? hours : 24}
          onChange={(e) => setHours(Math.max(1, Number(e.target.value) || 24))}
          className="w-full rounded-lg border px-3 py-2 text-left"
          dir="ltr"
        />
      </div>

      {/* Actions */}
      <div className="sm:col-span-1 flex gap-3">
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 border bg-black text-white hover:opacity-90"
        >
          نمایش گزارش
        </button>
        <a
          href="/reports/daily-production"
          className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 border"
        >
          پاک‌سازی
        </a>
      </div>
    </form>
  );
}
