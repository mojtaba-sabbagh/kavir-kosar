import { prisma } from '@/lib/db';
import FormBuilder from './form-builder';

export default async function BuilderPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const [formInfo, fields, report, allForms] = await Promise.all([
    prisma.form.findUnique({ where: { id }, select: { id:true, code:true, titleFa:true, isActive:true, sortOrder:true, version:true } }),
    prisma.formField.findMany({ where: { formId: id }, orderBy: { order: 'asc' }, select: { id:true, key:true, labelFa:true, type:true, required:true, order:true, config:true } }),
    prisma.report.findUnique({ where: { formId: id }, select: { visibleColumns:true, filterableKeys:true, orderableKeys:true, defaultOrder:true } }),
    prisma.form.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { titleFa: 'asc' }],
      select: { code: true, titleFa: true },
    }),
  ]);

  return (
    <FormBuilder
      form={formInfo!}
      fields={fields}
      initialReportConfig={{
        visibleColumns: report?.visibleColumns ?? [],
        filterableKeys: report?.filterableKeys ?? [],
        orderableKeys:  report?.orderableKeys  ?? [],
        defaultOrder:   (report?.defaultOrder as any) ?? { key:'createdAt', dir:'desc' },
      }}
      allForms={allForms}
    />
  );
}
