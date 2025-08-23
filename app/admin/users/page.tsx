// app/admin/users/page.tsx
import { prisma } from '@/lib/db';
import UsersCreateForm from './users-create-form';
import UserEditDialog from './user-edit-dialog'; // ⬅️ add this
import DeleteUserForm from './delete-user-form';

export default async function UsersPage() {
  const [users, roles] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: { roles: { include: { role: true } } },
    }),
    prisma.role.findMany({ orderBy: { name: 'asc' } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-6">
        <h2 className="text-lg font-bold mb-4">ایجاد کاربر جدید</h2>
        <UsersCreateForm allRoles={roles} />
      </div>

      <div className="rounded-2xl border bg-white p-6">
        <h2 className="text-lg font-bold mb-4">فهرست کاربران</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-right text-gray-500">
                <th className="py-2">ایمیل</th>
                <th className="py-2">نام</th>
                <th className="py-2">گروه‌ها</th>
                <th className="py-2">ویرایش</th>
                <th className="py-2">حذف</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-t">
                  <td className="py-2">{u.email}</td>
                  <td className="py-2">{u.name ?? '—'}</td>
                  <td className="py-2">{u.roles.map(r => r.role.name).join('، ') || '—'}</td>
                  <td className="py-2">
                    <UserEditDialog user={u as any} allRoles={roles} />
                  </td>
                  <td className="py-2">
                    <DeleteUserForm userId={u.id} />
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td className="py-4 text-gray-500" colSpan={5}>کاربری یافت نشد.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
