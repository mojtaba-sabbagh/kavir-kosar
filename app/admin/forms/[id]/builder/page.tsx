import { prisma } from '@/lib/db';
import { requireAdminOrRedirect } from '@/lib/rbac';
import FormBuilder from './form-builder';

export default async function BuilderPage(
  props: { params: Promise<{ id: string }> }
) {
  await requireAdminOrRedirect();
  const { id } = await props.params;

  const form = await prisma.form.findUnique({
    where: { id },
    include: { fields: true },
  });
  if (!form) return <div className="text-red-600">فرم یافت نشد</div>;

  // Normalize fields for client
  const fields = form.fields
    .map(f => ({ id: f.id, key: f.key, labelFa: f.labelFa, type: f.type, required: f.required, order: f.order ?? 0, config: f.config ?? {} }))
    .sort((a,b)=>a.order-b.order);

  return (
    <FormBuilder
      form={{ id: form.id, code: form.code, titleFa: form.titleFa, isActive: form.isActive, sortOrder: form.sortOrder, version: form.version }}
      fields={fields}
    />
  );
}
