// app/admin/forms/[id]/page.tsx
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import FormBuilder from './builder/form-builder';

export default async function FormEditPage(ctx: { params: Promise<{ id: string }> }) {
  const  params  = await ctx.params;
  const form = await prisma.form.findUnique({
    where: { id: params.id },
    select: { id: true, code: true, titleFa: true, isActive: true, sortOrder: true, version: true },
  });
  if (!form) return notFound();

  const fields = await prisma.formField.findMany({
    where: { formId: form.id },
    orderBy: { order: 'asc' },
    select: { id: true, key: true, labelFa: true, type: true, required: true, order: true, config: true },
  });

  // if you already persist report-config, prefetch it; otherwise provide sane defaults
  const report = await prisma.report.findFirst({
    where: { formId: form.id },
    select: {
      visibleColumns: true,
      filterableKeys: true,
      orderableKeys: true,
      defaultOrder: true,
    },
  });

  const initialReportConfig = {
    visibleColumns: report?.visibleColumns ?? [],
    filterableKeys: report?.filterableKeys ?? [],
    orderableKeys: report?.orderableKeys ?? ['createdAt'],
    defaultOrder: (report?.defaultOrder as any) ?? { key: 'createdAt', dir: 'desc' },
  };
  
  // NEW: lightweight list of all forms (for entryRef multi-select)
  const allForms = await prisma.form.findMany({
    select: { id: true, code: true, titleFa: true },
    orderBy: [{ sortOrder: 'asc' }, { titleFa: 'asc' }],
  });

  return (
    <FormBuilder
      form={form}
      fields={fields}
      initialReportConfig={initialReportConfig}
      allForms={allForms}
    />
  );
}
