// lib/report-sync.ts
import { prisma } from '@/lib/db';

export async function ensureReportForForm(formId: string) {
  const form = await prisma.form.findUnique({ where: { id: formId }, select: { id:true, code:true, titleFa:true, sortOrder:true }});
  if (!form) return;

  const exists = await prisma.report.findUnique({ where: { formId: form.id } });
  if (!exists) {
    await prisma.report.create({
      data: {
        formId: form.id,
        code: `RPT:FORM:${form.code}`,
        titleFa: `گزارش ${form.titleFa}`,
        sortOrder: form.sortOrder,
      },
    });
  } else {
    // only keep metadata in sync – DO NOT touch config fields
    await prisma.report.update({
      where: { formId: form.id },
      data: { titleFa: `گزارش ${form.titleFa}`, sortOrder: form.sortOrder },
    });
  }
}
