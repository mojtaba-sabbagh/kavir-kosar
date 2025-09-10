// lib/report-sync.ts
import { prisma } from '@/lib/db';

// Ensure a one-to-one Report row for a Form, code = "RPT:FORM:<FORMCODE>"
export async function ensureReportForForm(formId: string) {
  const form = await prisma.form.findUnique({
    where: { id: formId },
    select: { id: true, code: true, titleFa: true, sortOrder: true },
  });
  if (!form) return;

  const code = `RPT:FORM:${form.code}`;

  await prisma.report.upsert({
    where: { code }, // Report.code is unique
    update: {
      titleFa: `گزارش ${form.titleFa}`,
      sortOrder: form.sortOrder,
      formId: form.id, // keep the 1–1 tie in sync
    },
    create: {
      code,
      titleFa: `گزارش ${form.titleFa}`,
      sortOrder: form.sortOrder,
      formId: form.id,
    },
  });
}

/**
 * Mirror RoleFormPermission.canRead -> RoleReportPermission (for the form's report)
 *
 * changes: Array of { roleId, formId, canRead }
 *  - if canRead === true  -> ensure RoleReportPermission exists
 *  - if canRead === false -> ensure RoleReportPermission is removed
 */
export async function syncReportPermsBulk(
  changes: Array<{ roleId: string; formId: string; canRead: boolean }>
) {
  if (!changes?.length) return;

  // 1) Ensure there is a Report row for each form (defensive)
  const formIds = Array.from(new Set(changes.map(c => c.formId)));
  const forms = await prisma.form.findMany({
    where: { id: { in: formIds } },
    select: { id: true },
  });
  await Promise.all(forms.map(f => ensureReportForForm(f.id)));

  // 2) Fetch reports for those forms
  const reports = await prisma.report.findMany({
    where: { formId: { in: formIds } },
    select: { id: true, formId: true },
  });
  const reportByFormId = new Map(reports.map(r => [r.formId, r]));

  // 3) Build mutations
  const creates: Array<{ reportId: string; roleId: string }> = [];
  const deletes: Array<{ reportId: string; roleId: string }> = [];

  for (const c of changes) {
    const rep = reportByFormId.get(c.formId);
    if (!rep) continue; // no report found (shouldn’t happen after ensure)

    if (c.canRead) {
      creates.push({ reportId: rep.id, roleId: c.roleId });
    } else {
      deletes.push({ reportId: rep.id, roleId: c.roleId });
    }
  }

  // 4) Apply in a transaction
  await prisma.$transaction(async tx => {
    // Upsert/create read permission
    for (const crt of creates) {
      await tx.roleReportPermission.upsert({
        where: { roleId_reportId: { reportId: crt.reportId, roleId: crt.roleId } },
        update: {},    // nothing else to update; presence means "can read"
        create: { reportId: crt.reportId, roleId: crt.roleId },
      });
    }
    // Delete read permission where canRead=false
    for (const del of deletes) {
      await tx.roleReportPermission.deleteMany({
        where: { reportId: del.reportId, roleId: del.roleId },
      });
    }
  });
}
