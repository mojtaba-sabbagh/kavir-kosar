// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Roles
  const [adminRole, managerRole, employeeRole] = await Promise.all([
    prisma.role.upsert({ where: { name: 'admin' }, update: {}, create: { name: 'admin' } }),
    prisma.role.upsert({ where: { name: 'manager' }, update: {}, create: { name: 'manager' } }),
    prisma.role.upsert({ where: { name: 'employee' }, update: {}, create: { name: 'employee' } }),
  ]);

  // Admin user
  const passwordHash = await bcrypt.hash('Admin@12345', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@tordilla.ir' },
    update: {},
    create: { email: 'admin@tordilla.ir', name: 'مدیر سیستم', passwordHash },
  });

  // Attach admin role
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
    update: {},
    create: { userId: admin.id, roleId: adminRole.id },
  });

  // Sample forms
  const forms = await Promise.all([
    prisma.form.upsert({ where: { code: 'HR-REQ-01' }, update: {}, create: { code: 'HR-REQ-01', titleFa: 'فرم درخواست مرخصی', sortOrder: 10 } }),
    prisma.form.upsert({ where: { code: 'FIN-REQ-02' }, update: {}, create: { code: 'FIN-REQ-02', titleFa: 'فرم درخواست پرداخت', sortOrder: 20 } }),
    prisma.form.upsert({ where: { code: 'OPS-REP-03' }, update: {}, create: { code: 'OPS-REP-03', titleFa: 'گزارش عملیات روزانه', sortOrder: 30 } }),
  ]);

  // Give admin access to all forms
  for (const f of forms) {
    await prisma.roleFormPermission.upsert({
      where: { roleId_formId: { roleId: adminRole.id, formId: f.id } },
      update: { canRead: true, canSubmit: true },
      create: { roleId: adminRole.id, formId: f.id, canRead: true, canSubmit: true },
    });
  }

  console.log('✅ Seed done. Login with admin@kkraf.ir / Admin@12345');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
