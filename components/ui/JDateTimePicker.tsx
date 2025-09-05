'use client';
import { useMemo } from 'react';
import DatePicker, { DateObject } from 'react-multi-date-picker';
import persian from 'react-date-object/calendars/persian';
import persian_fa from 'react-date-object/locales/persian_fa';
import TimePicker from 'react-multi-date-picker/plugins/time_picker';

type Props = {
  value?: string | null;                  // ISO like "2025-09-05T14:30:00Z" or local
  onChange: (iso: string | null) => void;
  placeholder?: string;
  className?: string;
};

export default function JDateTimePicker({ value, onChange, placeholder='تاریخ و زمان را انتخاب کنید', className }: Props) {
  const dateObj = useMemo(() => {
    if (!value) return null;
    const d = new Date(value);
    if (isNaN(+d)) return null;
    return new DateObject(d);
  }, [value]);

  return (
    <DatePicker
      value={dateObj}
      onChange={(d: any) => {
        if (!d) return onChange(null);
        const jsDate = (d as DateObject).toDate();
        // Save full ISO (UTC); adjust per your backend convention if needed:
        onChange(jsDate.toISOString());
      }}
      calendar={persian}
      locale={persian_fa}
      plugins={[ <TimePicker key="time" hideSeconds /> ]}
      animations={[]}
      inputClass={`w-full rounded-md border px-3 py-2 ${className ?? ''}`}
      calendarPosition="bottom-right"
      placeholder={placeholder}
      editable={false}
      style={{ width: '100%' }}
    />
  );
}
