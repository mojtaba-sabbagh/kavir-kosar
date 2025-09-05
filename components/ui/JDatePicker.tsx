'use client';
import { useMemo } from 'react';
import DatePicker, { DateObject } from 'react-multi-date-picker';
import persian from 'react-date-object/calendars/persian';
import persian_fa from 'react-date-object/locales/persian_fa';

type Props = {
  value?: string | null;                 // ISO like "2025-09-05"
  onChange: (iso: string | null) => void;
  placeholder?: string;
  className?: string;
};

export default function JDatePicker({ value, onChange, placeholder = 'تاریخ را انتخاب کنید', className }: Props) {
  // Parse incoming ISO (Gregorian) to DateObject (Persian calendar for UI)
  const dateObj = useMemo(() => {
    if (!value) return null;
    const d = new Date(value);
    if (isNaN(+d)) return null;
    return new DateObject(d); // underlying JS Date (gregorian)
  }, [value]);

  return (
    <DatePicker
      value={dateObj}
      onChange={(d: any) => {
        if (!d) return onChange(null);
        // Convert UI Persian date to real JS Date (gregorian) then to ISO YYYY-MM-DD
        const jsDate = (d as DateObject).toDate();
        const iso = jsDate.toISOString().slice(0, 10); // YYYY-MM-DD
        onChange(iso);
      }}
      calendar={persian}
      locale={persian_fa}
      inputClass={`w-full rounded-md border px-3 py-2 ${className ?? ''}`}
      calendarPosition="bottom-right"
      placeholder={placeholder}
      editable={false}
      style={{ width: '100%' }}
    />
  );
}
