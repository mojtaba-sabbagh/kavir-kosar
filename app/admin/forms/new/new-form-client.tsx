'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewFormClient() {
  const [code, setCode] = useState('');
  const [titleFa, setTitleFa] = useState('');
  const [sortOrder, setSortOrder] = useState('100');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    const res = await fetch('/api/admin/forms', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ code, titleFa, sortOrder: Number(sortOrder), isActive })
    });
    setLoading(false);
    if (res.ok) {
      const { id } = await res.json();
      router.replace(`/admin/forms/${id}/builder`);
    } else {
      const j = await res.json().catch(()=>({}));
      setError(j.message || 'خطا در ایجاد فرم');
    }
  };

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-bold mb-4">فرم جدید</h1>
      <form onSubmit={onSubmit} className="space-y-4 bg-white border rounded-xl p-4">
        <div>
          <label className="block text-sm mb-1">کد فرم *</label>
          <input className="w-full border rounded-md px-3 py-2 font-mono" dir="ltr" value={code} onChange={e=>setCode(e.target.value)} placeholder="OPS-WASTE" />
        </div>
        <div>
          <label className="block text-sm mb-1">عنوان *</label>
          <input className="w-full border rounded-md px-3 py-2" value={titleFa} onChange={e=>setTitleFa(e.target.value)} placeholder="عنوان فارسی فرم" />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-sm mb-1">ترتیب</label>
            <input type="number" className="w-full border rounded-md px-3 py-2" dir="ltr" value={sortOrder} onChange={e=>setSortOrder(e.target.value)} />
          </div>
          <label className="flex items-end gap-2">
            <input type="checkbox" checked={isActive} onChange={e=>setIsActive(e.target.checked)} />
            <span>فعال</span>
          </label>
        </div>
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <button className="w-full bg-blue-600 text-white rounded-md py-2 disabled:opacity-50" disabled={loading}>
          {loading ? 'در حال ایجاد…' : 'ایجاد'}
        </button>
      </form>
    </div>
  );
}
