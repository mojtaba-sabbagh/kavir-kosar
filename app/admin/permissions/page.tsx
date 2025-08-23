import { prisma } from '@/lib/db';
import PermissionsEditor from './permissions-editor';

export default async function PermissionsPage() {
  const roles = await prisma.role.findMany({ orderBy: { name: 'asc' } });
  const forms = await prisma.form.findMany({ orderBy: { sortOrder: 'asc' } });
  const perms = await prisma.roleFormPermission.findMany();

  return (
    <div className="rounded-2xl border bg-white p-0 overflow-hidden">
      {/* full-bleed header */}
      <div className="px-4 py-4 border-b">
        <h2 className="text-lg font-bold">تنظیم مجوزها (نقش × فرم)</h2>
      </div>

      {/* full-width scroll container */}
      <div className="overflow-x-auto">
        <PermissionsEditor roles={roles} forms={forms} perms={perms} />
      </div>
    </div>
  );
}
