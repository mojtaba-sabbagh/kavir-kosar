import { prisma } from '@/lib/db';
import FormBuilder from './form-builder';

export default async function BuilderPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;

  const [form, fields, report] = await Promise.all([
    prisma.form.findUnique({ where: { id }, select: { id:true, code:true, titleFa:true, isActive:true, sortOrder:true, version:true } }),
    prisma.formField.findMany({ where: { formId: id }, orderBy: { order: 'asc' },
      select: { id:true, key:true, labelFa:true, type:true, required:true, order:true, config:true } }),
    prisma.report.findUnique({
      where: { formId: id },
      select: {
        visibleColumns:true, filterableKeys:true, orderableKeys:true, defaultOrder:true,
      },
    }),
  ]);

  const initialReportConfig = report ? {
    visibleColumns: report.visibleColumns ?? [],
    filterableKeys: report.filterableKeys ?? [],
    orderableKeys:  report.orderableKeys  ?? [],
    defaultOrder:   (report.defaultOrder as any) ?? { key: 'createdAt', dir: 'desc' },
  } : {
    visibleColumns: [],
    filterableKeys: [],
    orderableKeys:  ['createdAt'],
    defaultOrder:   { key: 'createdAt', dir: 'desc' as const },
  };

  return (
    <FormBuilder
      form={form!}
      fields={fields}
      initialReportConfig={initialReportConfig}
    />
  );
}
