import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const url = new URL(req.url);
    const includeFields = url.searchParams.get('include') === 'fields';

    const form = await prisma.form.findUnique({
      where: { code },
      include: {
        fields: includeFields ? true : false,
      },
    });

    if (!form) {
      return NextResponse.json(
        { message: 'فرم یافت نشد' },
        { status: 404 }
      );
    }

    return NextResponse.json({ form });
  } catch (error: any) {
    console.error('Error fetching form by code:', error);
    return NextResponse.json(
      { message: 'خطا در دریافت فرم' },
      { status: 500 }
    );
  }
}
