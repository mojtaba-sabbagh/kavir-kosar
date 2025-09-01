import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import DynamicForm from '@/components/forms/DynamicForm';

export default async function FormByCodePage(
  props: { params: Promise<{ code: string }> } // 👈 params is a Promise
) {
  const { code } = await props.params;         // 👈 await it

  const user = await getSession();
  if (!user) redirect(`/auth/sign-in?next=/forms/${encodeURIComponent(code)}`);

  const form = await prisma.form.findUnique({
    where: { code },
    select: { id: true, code: true, titleFa: true, isActive: true, fields: true },
  });
  if (!form || !form.isActive) notFound();

  return (
    <DynamicForm
      form={{ code: form.code, titleFa: form.titleFa }}
      fields={form.fields}
    />
  );
}
