'use client';

import { useState } from 'react';

type Role = { id: string; name: string };

export default function RolesCell({
  userId,
  allRoles,
  currentRoleIds,
}: {
  userId: string;
  allRoles: Role[];
  currentRoleIds: string[];
}) {
  const [roleIds, setRoleIds] = useState<string[]>(currentRoleIds);
  const [saving, setSaving] = useState(false);

  const toggleRole = async (id: string) => {
    const newIds = roleIds.includes(id)
      ? roleIds.filter(r => r !== id)
      : [...roleIds, id];
    setRoleIds(newIds);
    setSaving(true);

    const res = await fetch(`/api/admin/users/${userId}/roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleIds: newIds }),
    });

    setSaving(false);
    if (!res.ok) {
      alert('بروزرسانی نقش‌ها ناموفق بود');
      setRoleIds(currentRoleIds); // revert if error
    }
  };

  return (
    <div className="flex flex-wrap gap-2 text-sm">
      {allRoles.map(r => (
        <label key={r.id} className="inline-flex items-center gap-1">
          <input
            type="checkbox"
            checked={roleIds.includes(r.id)}
            disabled={saving}
            onChange={() => toggleRole(r.id)}
          />
          <span>{r.name}</span>
        </label>
      ))}
    </div>
  );
}
