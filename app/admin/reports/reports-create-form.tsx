'use client';
import { useState } from 'react';

export default function ReportsCreateForm() {
  const [code, setCode] = useState('');
  const [titleFa, setTitleFa] = useState('');
  const [url, setUrl] = useState('');
  const [sortOrder, setSortOrder] = useState(100);
  const [isActive, setIsActive] = useState(true);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await fetch('/api/admin/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, titleFa, url: url || null, sortOrder, isActive }),
        });
        if (res.ok) location.reload();
        else alert('ثبت گزارش ناموفق بود');
      }}
      className="grid gap-3 sm:grid-cols-2"
    >
      <div>
        <label className="mb-1 block text-sm">کد گزارش</label>
        <input className="w-full rounded-md border px-3 py-2" value={code} onChange={e=>setCode(e.target.value)} placeholder="RPT-SALES-DAILY"/>
      </div>
      <div>
        <label className="mb-1 block text-sm">عنوان فارسی</label>
        <input className="w-full rounded-md border px-3 py-2" value={titleFa} onChange={e=>setTitleFa(e.target.value)} placeholder="گزارش فروش روزانه"/>
      </div>
      <div>
        <label className="mb-1 block text-sm">آدرس/مسیر (اختیاری)</label>
        <input
        className="w-full rounded-md border px-3 py-2"
        value={url}
        onChange={e=>setUrl(e.target.value)}
        dir="ltr"
        inputMode="url"
        autoComplete="url"
        placeholder="/reports/sales-daily یا https://…"
        />      
      </div>
      <div>
        <label className="mb-1 block text-sm">ترتیب نمایش</label>
        <input type="number" className="w-full rounded-md border px-3 py-2" value={sortOrder} onChange={e=>setSortOrder(parseInt(e.target.value || '0'))}/>
      </div>
      <div className="flex items-center gap-2 mt-1">
        <input id="active" type="checkbox" checked={isActive} onChange={e=>setIsActive(e.target.checked)} />
        <label htmlFor="active" className="text-sm">فعال</label>
      </div>
      <div className="sm:col-span-2">
        <button className="w-full rounded-md bg-gray-900 text-white py-2">ایجاد گزارش</button>
      </div>
    </form>
  );
}
