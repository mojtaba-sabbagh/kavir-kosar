import { requireAdminOrRedirect } from '@/lib/rbac';
import NewFormClient from './new-form-client';

export default async function NewFormPage() {
  await requireAdminOrRedirect();
  return <NewFormClient />;
}
