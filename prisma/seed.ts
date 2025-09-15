import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // ---- Roles
  const [adminRole, managerRole, employeeRole] = await Promise.all([
    prisma.role.upsert({ where: { name: 'admin' }, update: {}, create: { name: 'admin' } }),
    prisma.role.upsert({ where: { name: 'manager' }, update: {}, create: { name: 'manager' } }),
    prisma.role.upsert({ where: { name: 'employee' }, update: {}, create: { name: 'employee' } }),
  ]);

  // ---- Admin user
  const passwordHash = await bcrypt.hash('Admin@12345', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@tordilla.ir' },
    update: {},
    create: { email: 'admin@tordilla.ir', name: 'مدیر سیستم', passwordHash },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
    update: {},
    create: { userId: admin.id, roleId: adminRole.id },
  });

  /*/ ---- Sample Forms
  const forms = await Promise.all([
    prisma.form.upsert({ where: { code: 'HR-REQ-01' }, update: {}, create: { code: 'HR-REQ-01', titleFa: 'فرم درخواست مرخصی', sortOrder: 10 } }),
    prisma.form.upsert({ where: { code: 'FIN-REQ-02' }, update: {}, create: { code: 'FIN-REQ-02', titleFa: 'فرم درخواست پرداخت', sortOrder: 20 } }),
    prisma.form.upsert({ where: { code: 'OPS-REP-03' }, update: {}, create: { code: 'OPS-REP-03', titleFa: 'گزارش عملیات روزانه', sortOrder: 30 } }),
  ]);

  // grant admin full form permissions
  for (const f of forms) {
    await prisma.roleFormPermission.upsert({
      where: { roleId_formId: { roleId: adminRole.id, formId: f.id } },
      update: { canRead: true, canSubmit: true },
      create: { roleId: adminRole.id, formId: f.id, canRead: true, canSubmit: true },
    });
  }

  // ---- Reports (if you added the models)
  const rptSales = await prisma.report.upsert({
    where: { code: 'RPT-SALES-DAILY' },
    update: {},
    create: { code: 'RPT-SALES-DAILY', titleFa: 'گزارش فروش روزانه', url: '/reports/sales-daily', sortOrder: 10 },
  });
  const rptHR = await prisma.report.upsert({
    where: { code: 'RPT-HR-ATTN' },
    update: {},
    create: { code: 'RPT-HR-ATTN', titleFa: 'گزارش حضور و غیاب', url: '/reports/hr-attendance', sortOrder: 20 },
  });

  await prisma.roleReportPermission.upsert({
    where: { roleId_reportId: { roleId: adminRole.id, reportId: rptSales.id } },
    update: { canView: true },
    create: { roleId: adminRole.id, reportId: rptSales.id, canView: true },
  });
  await prisma.roleReportPermission.upsert({
    where: { roleId_reportId: { roleId: adminRole.id, reportId: rptHR.id } },
    update: { canView: true },
    create: { roleId: adminRole.id, reportId: rptHR.id, canView: true },
  });

  console.log('✅ Seed done. Login with admin@tordilla.ir / Admin@12345');

// 3) OPS-WASTE form
const wasteForm = await prisma.form.upsert({
  where: { code: 'OPS-WASTE' },
  update: { titleFa: 'فرم ثبت ضایعات تولید', isActive: true, sortOrder: 50 },
  create: { code: 'OPS-WASTE', titleFa: 'فرم ثبت ضایعات تولید', isActive: true, sortOrder: 50 },
});

  // Remove old fields (if re-seeding)
  await prisma.formField.deleteMany({ where: { formId: wasteForm.id } });

  // Create fields
  await prisma.formField.createMany({
    data: [
      {
        formId: wasteForm.id,
        key: 'date',
        labelFa: 'تاریخ',
        type: 'date',
        required: true,
        order: 10,
      },
      {
        formId: wasteForm.id,
        key: 'shift',
        labelFa: 'شیفت',
        type: 'select',
        required: true,
        order: 20,
        config: {
          options: [
            { value: '1', label: '۱' },
            { value: '2', label: '۲' },
            { value: '3', label: '۳' },
          ],
        } as any,
      },
      {
        formId: wasteForm.id,
        key: 'wasteType',
        labelFa: 'ضایعات',
        type: 'select',
        required: true,
        order: 30,
        config: {
          options: [
            { value: 'paper', 'label': 'برگه' },
            { value: 'dough', 'label': 'خمیر' },
            { value: 'under-screw', 'label': 'زیرماردون' },
          ],
        } as any,
      },
      {
        formId: wasteForm.id,
        key: 'amount',
        labelFa: 'مقدار (کیلوگرم)',
        type: 'number',
        required: true,
        order: 40,
        config: { min: 0, step: 0.01, decimals: true } as any,
      },
      // Example file attachment field (optional for future forms)
      // {
      //   formId: wasteForm.id,
      //   key: 'attachment',
      //   labelFa: 'پیوست',
      //   type: 'file',
      //   required: false,
      //   order: 50,
      // },
    ],
  });

  // 4) Give admin full permissions on this form
  await prisma.roleFormPermission.upsert({
    where: { roleId_formId: { roleId: adminRole.id, formId: wasteForm.id } },
    update: {
      canRead: true, canSubmit: true, canConfirm: false, canFinalConfirm: true,
    },
    create: {
      roleId: adminRole.id, formId: wasteForm.id,
      canRead: true, canSubmit: true, canConfirm: false, canFinalConfirm: true,
    },
  });

  console.log('✅ Seed finished: admin + OPS-WASTE form and fields created.');*/

// Create Kardex report
const kardexReport = await prisma.report.upsert({
    where: { code: 'KARDEX' },
    update: { 
      titleFa: 'گزارش کاردکس کالا',
      url: '/reports/kardex'  // Added URL update here
    },
    create: { 
      code: 'KARDEX', 
      titleFa: 'گزارش کاردکس کالا',
      url: '/reports/kardex'  // Added URL for create as well
    },
  });


await prisma.roleReportPermission.upsert({
  where: { roleId_reportId: { roleId: adminRole.id, reportId: kardexReport.id } },
  update: { canView: true },
  create: { roleId: adminRole.id, reportId: kardexReport.id, canView: true },
});

}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });