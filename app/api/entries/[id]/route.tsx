// app/api/entries/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { EntryStatus } from '@prisma/client';
import { cookies, headers } from 'next/headers';

// ---- helpers: async cookies/headers + JWT decode ----
async function readCookie(name: string): Promise<string | null> {
  try {
    const jar = await cookies();
    const hit = jar.get(name);
    return hit?.value ?? null;
  } catch {
    return null;
  }
}

function base64UrlToUtf8(b64url: string): string {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4;
  const padded = pad ? b64 + '='.repeat(4 - pad) : b64;
  return Buffer.from(padded, 'base64').toString('utf8');
}

function decodeJwtNoVerify(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payloadJson = base64UrlToUtf8(parts[1]);
    return JSON.parse(payloadJson);
  } catch {
    return null;
  }
}

async function getOptionalUserId(): Promise<string | null> {
  // 1) 'session' cookie (JWT with sub/email)
  const sess = await readCookie('session');
  if (sess) {
    const payload = decodeJwtNoVerify(sess);
    if (payload?.sub) return String(payload.sub);
    if (payload?.email) {
      const u = await prisma.user.findUnique({
        where: { email: String(payload.email) },
        select: { id: true },
      });
      if (u?.id) return u.id;
    }
  }
  // 2) fallback cookies
  const names = ['sessionUserId', 'uid', 'userId', 'auth_user_id', 'userid'];
  for (const k of names) {
    const v = await readCookie(k);
    if (v) return v;
  }
  // 3) proxy headers
  try {
    const h = await headers();
    const v = h.get('x-user-id') || h.get('x-auth-user-id') || h.get('x-user');
    if (v) return v;
  } catch {}
  return null;
}

async function userCanSubmitOnForm(userId: string, formId: string): Promise<boolean> {
  const roles = await prisma.userRole.findMany({
    where: { userId },
    select: { roleId: true },
  });
  if (!roles.length) return false;
  const roleIds = roles.map(r => r.roleId);
  const perm = await prisma.roleFormPermission.findFirst({
    where: { formId, canSubmit: true, roleId: { in: roleIds } },
    select: { id: true },
  });
  return !!perm;
}

function isLocked(status: EntryStatus) {
  return status === 'confirmed' || status === 'finalConfirmed';
}

// ---------- PUT /api/entries/[id] (update payload) ----------
export async function PUT(req: NextRequest,   { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getOptionalUserId();
    if (!userId) {
      return NextResponse.json({ ok: false, message: 'نیاز به ورود' }, { status: 401 });
    }

    const { id } = await params;

    // Load entry to know formId + status
    const entry = await prisma.formEntry.findUnique({
      where: { id },
      select: { id: true, formId: true, status: true },
    });
    if (!entry) {
      return NextResponse.json({ ok: false, message: 'آیتم یافت نشد' }, { status: 404 });
    }
    // RBAC
    if (!(await userCanSubmitOnForm(userId, entry.formId))) {
      return NextResponse.json({ ok: false, message: 'اجازه دسترسی ندارید' }, { status: 403 });
    }
    // Workflow lock
    if (isLocked(entry.status)) {
      return NextResponse.json({ ok: false, message: 'آیتم پس از تأیید قابل ویرایش نیست' }, { status: 409 });
    }

    // Parse and validate payload
    const body = await req.json().catch(() => ({}));
    const nextPayload = body?.payload;
    if (!nextPayload || typeof nextPayload !== 'object') {
      return NextResponse.json({ ok: false, message: 'payload نامعتبر است' }, { status: 400 });
    }

    // Filter to registered field keys for this form
    const fields = await prisma.formField.findMany({
      where: { formId: entry.formId },
      select: { key: true },
    });
    const allowed = new Set(fields.map(f => f.key));
    const filteredPayload: Record<string, any> = {};
    for (const [k, v] of Object.entries(nextPayload)) {
      if (allowed.has(k)) filteredPayload[k] = v;
    }

    await prisma.formEntry.update({
      where: { id: entry.id },
      data: { payload: filteredPayload },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, message: 'خطای سرور' }, { status: 500 });
  }
}

// ---------- DELETE /api/entries/[id] ----------
export async function DELETE(req: NextRequest,  { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getOptionalUserId();
    if (!userId) {
      return NextResponse.json({ ok: false, message: 'نیاز به ورود' }, { status: 401 });
    }

    const { id } = await params;

    const entry = await prisma.formEntry.findUnique({
      where: { id },
      select: { id: true, formId: true, status: true, kardexApplied: true },
    });
    if (!entry) {
      return NextResponse.json({ ok: false, message: 'آیتم یافت نشد' }, { status: 404 });
    }
    if (!(await userCanSubmitOnForm(userId, entry.formId))) {
      return NextResponse.json({ ok: false, message: 'اجازه دسترسی ندارید' }, { status: 403 });
    }
    if (isLocked(entry.status)) {
      return NextResponse.json({ ok: false, message: 'آیتم تأیید شده قابل حذف نیست' }, { status: 409 });
    }

    // Optional safety:
    // if (entry.kardexApplied) {
    //   return NextResponse.json({ ok: false, message: 'آیتمی که در کاردکس اعمال شده قابل حذف نیست' }, { status: 409 });
    // }

    await prisma.formEntry.delete({ where: { id: entry.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, message: 'خطای سرور' }, { status: 500 });
  }
}
