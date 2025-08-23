import { prisma } from './db';


export async function getAllowedFormsForUser(userId: string) {
// جمع‌آوری نقش‌های کاربر → فرم‌های مجاز
return prisma.form.findMany({
where: {
rolePermissions: {
some: {
role: { users: { some: { userId } } },
canSubmit: true
}
}
},
orderBy: { sortOrder: 'asc' }
});
}