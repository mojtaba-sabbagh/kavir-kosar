import { prisma } from '@/lib/db';
import RolesCreateForm from './roles-create-form';
import DeleteRoleForm from './delete-role-form';
import RoleEditDialog from './role-edit-dialog';

export default async function RolesPage() {
  const roles = await prisma.role.findMany({ orderBy: { name: 'asc' } });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-6">
        <h2 className="text-lg font-bold mb-4">ایجاد گروه جدید</h2>
        <RolesCreateForm />
      </div>

      <div className="rounded-2xl border bg-white p-6">
        <h2 className="text-lg font-bold mb-4">فهرست گروه‌ها</h2>

        {/* Optional inline error if redirected with ?error=in-use */}
        {/* You can read searchParams server-side if you want to show a message */}

        <ul className="space-y-2">
          {roles.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 border rounded-md p-3">
              <div className="font-medium">{r.name}</div>
              <div className="flex items-center gap-2">
                <RoleEditDialog roleId={r.id} currentName={r.name} />
                <DeleteRoleForm roleId={r.id} />
              </div>
            </li>
          ))}
          {roles.length === 0 && (
            <li className="text-gray-500">گروهی ثبت نشده است.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
