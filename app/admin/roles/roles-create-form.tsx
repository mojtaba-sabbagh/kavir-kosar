'use client';
import { useState } from 'react';

export default function RolesCreateForm() {
  const [name, setName] = useState('');

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await fetch('/api/admin/roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });
        if (res.ok) location.reload();
        else alert('ثبت گروه ناموفق بود');
      }}
      className="flex gap-3"
    >
      <input className="flex-1 rounded-md border px-3 py-2" value={name} onChange={e=>setName(e.target.value)} placeholder="نام گروه (مثلاً admin)"/>
      <button className="rounded-md bg-gray-900 text-white px-4">ایجاد</button>
    </form>
  );
}
