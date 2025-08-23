'use client';
import { useState } from 'react';

export default function FormsCreateForm() {
  const [code, setCode] = useState('');
  const [titleFa, setTitleFa] = useState('');
  const [sortOrder, setSortOrder] = useState(100);
  const [isActive, setIsActive] = useState(true);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await fetch('/api/admin/forms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, titleFa, sortOrder, isActive }),
        });
        if (res.ok) location.reload();
        else alert('ثبت فرم ناموفق بود');
      }}
      className="grid gap-3 sm:grid-cols-2"
    >
      <div>
        <label className="mb-1 block text-sm">کد فرم</label>
        <input className="w-full rounded-md border px-3 py-2" value={code} onChange={e=>setCode(e.target.value)} placeholder="HR-REQ-01"/>
      </div>
      <div>
        <label className="mb-1 block text-sm">عنوان فارسی</label>
        <input className="w-full rounded-md border px-3 py-2" value={titleFa} onChange={e=>setTitleFa(e.target.value)} placeholder="فرم درخواست مرخصی"/>
      </div>
      <div>
        <label className="mb-1 block text-sm">ترتیب نمایش</label>
        <input type="number" className="w-full rounded-md border px-3 py-2" value={sortOrder} onChange={e=>setSortOrder(parseInt(e.target.value || '0'))}/>
      </div>
      <div className="flex items-center gap-2 mt-6">
        <input id="active" type="checkbox" checked={isActive} onChange={e=>setIsActive(e.target.checked)} />
        <label htmlFor="active" className="text-sm">فعال</label>
      </div>
      <div className="sm:col-span-2">
        <button className="w-full rounded-md bg-gray-900 text-white py-2">ایجاد فرم</button>
      </div>
    </form>
  );
}
