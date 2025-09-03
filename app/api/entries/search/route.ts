import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim();
  const codes = (url.searchParams.getAll('code') || []).filter(Boolean); // allowedFormCodes

  // Find forms the user can read (and match allowed codes if provided)
  const readable = await prisma.roleFormPermission.findMany({
    where: {
      canRead: true,
      role: { users: { some: { userId: user.id } } },
      ...(codes.length ? { form: { code: { in: codes } } } : {}),
    },
    select: { formId: true, form: { select: { code: true, titleFa: true } } },
  });

  const formIds = readable.map(r => r.formId);
  if (formIds.length === 0) return NextResponse.json({ items: [] });

  // Very simple search: by code or recent entries
  const entries = await prisma.formEntry.findMany({
    where: { formId: { in: formIds } },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      formId: true,
      createdAt: true,
    },
  });

  // Map formId → code/title
  const byFormId = Object.fromEntries(readable.map(r => [r.formId, { code: r.form.code, titleFa: r.form.titleFa }]));

  // Optional: apply q filter against id or code
  const filtered = q
    ? entries.filter(e =>
        e.id.includes(q) || byFormId[e.formId]?.code?.toLowerCase().includes(q.toLowerCase())
      )
    : entries;

  const items = filtered.map(e => ({
    id: e.id,
    formCode: byFormId[e.formId]?.code,
    formTitle: byFormId[e.formId]?.titleFa,
    label: `${byFormId[e.formId]?.titleFa ?? ''} (${byFormId[e.formId]?.code ?? ''}) – ${e.id.slice(0,8)}…`,
  }));

  return NextResponse.json({ items });
}
