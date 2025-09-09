'use client';

import DatePicker, { DateObject } from "react-multi-date-picker";
import persian from 'react-date-object/calendars/persian';
import persian_fa from 'react-date-object/locales/persian_fa';


type Props = {
  label: string;
  value?: { from?: string; to?: string };
  onChange: (val: { from?: string; to?: string }) => void;
};

export default function JDateRangeFilter({ label, value, onChange }: Props) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-gray-600">{label}</div>
      <div className="flex items-center gap-2">
        <DatePicker
          inputClass="w-full border rounded-md px-2 py-1 text-sm"
          calendar={persian}
          locale={persian_fa}
          value={value?.from ? new DateObject(value.from) : null}
          onChange={(d) => onChange({ ...value, from: d?.toDate()?.toISOString() })}
          calendarPosition="bottom-right"
          editable={false}
          placeholder="از"
        />
        <span className="text-xs text-gray-500">تا</span>
        <DatePicker
          inputClass="w-full border rounded-md px-2 py-1 text-sm"
          calendar={persian}
          locale={persian_fa}
          value={value?.to ? new DateObject(value.to) : null}
          onChange={(d) => onChange({ ...value, to: d?.toDate()?.toISOString() })}
          calendarPosition="bottom-right"
          editable={false}
          placeholder="تا"
        />
      </div>
    </div>
  );
}
