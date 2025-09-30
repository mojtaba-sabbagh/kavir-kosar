import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import Link from 'next/link';

/** Read a cookie value using cookies().getAll() only */
function readCookie(name: string): string | null {
  try {
    const jar: any = cookies();
    const all: Array<{ name: string; value: string }> =
      typeof jar.getAll === 'function' ? jar.getAll() : [];
    const hit = all.find((c) => c.name === name);
    return hit?.value ?? null;
  } catch {
    return null;
  }
}

/** Get userId from your session cookie(s). Adjust the names as needed. */
async function getOptionalUserId(): Promise<string | null> {
  return (
    readCookie('sessionUserId') ||
    readCookie('uid') ||
    readCookie('userId')
  );
}

/**
 * RBAC check using RoleFormPermission:
 * canSend == canSubmit for the given form.
 *
 * Assumes Role has a relation `userRoles` to link users to roles:
 * model Role { userRoles UserRole[]; rolePermissions RoleFormPermission[] }
 * model UserRole { userId, roleId, ... }
 */
async function getCanSendForForm(formId: string): Promise<boolean> {
  const userId = await getOptionalUserId();
  if (!userId) return false;

  const hit = await prisma.roleFormPermission.findFirst({
    where: {
      formId,
      canSubmit: true, // ← maps to "canSend"
      role: {
        is: {                    // <— important: disambiguates RoleWhereInput vs RoleScalarRelationFilter
          users: {               // <— use the actual relation field name on Role (likely "users")
            some: { userId },
          },
        },
      },
    },
    select: { id: true },
  });

  return !!hit;
}

export default async function ReportByCode(ctx: { params: Promise<{ code: string }> }) {
  const params = await ctx.params;
  const decoded = decodeURIComponent(params.code);

  // 1) Find report by code
  const rpt = await prisma.report.findFirst({
    where: { code: decoded },
    select: { id: true, code: true, titleFa: true, url: true },
  });
  if (!rpt) return notFound();

  // 2) Custom page?
  if (rpt.url) redirect(rpt.url);

  // 3) Resolve form by code (report code == form code)
  const form = await prisma.form.findUnique({
    where: { code: decoded },
    select: { id: true, titleFa: true },
  });
  const formId = form?.id ?? null;

  // 4) Compute canSend (via RoleFormPermission.canSubmit)
  const canSend = formId ? await getCanSendForForm(formId) : false;

  // 5) Render generic report
  const Generic = (await import('../generic/form-report-client')).default;
  return (
    <div className="space-y-4">
        <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm">
            <h1 className="text-xl font-bold">گزارش فرم: {form?.titleFa ?? decoded}</h1>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-md border px-3 py-1 text-sm hover:bg-purple-50"
            title="بازگشت به خانه"
            prefetch
          >
            <span aria-hidden>←</span>
            <span>بازگشت</span>
          </Link>
        </div>
        <Generic code={decoded} canSend={canSend} />
    </div>
  );
}
