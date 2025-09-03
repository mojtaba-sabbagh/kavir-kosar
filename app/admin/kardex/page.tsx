import AdminKardexClient from './AdminKardexClient';
import { requireAdminOrRedirect } from '@/lib/rbac';

export default async function AdminKardexPage() {
  await requireAdminOrRedirect();
  return <AdminKardexClient />;
}
