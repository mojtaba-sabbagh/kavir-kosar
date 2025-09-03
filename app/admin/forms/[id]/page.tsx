// app/admin/forms/[id]/page.tsx
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import FormEditor from './ui/FormEditor';

export default async function FormEditPage({ params }: { params: { id: string } }) {
  const form = await prisma.form.findUnique({
    where: { id: params.id },
    include: { fields: { orderBy: { order: 'asc' } } },
  });
  if (!form) notFound();
  return <FormEditor initialForm={form} />;
}
