// app/api/forms/by-code/[code]/route.ts
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
    
    // Optional: Allow selecting specific fields
    const selectFields = url.searchParams.get('select')?.split(',');

    const form = await prisma.form.findUnique({
      where: { code },
      include: {
        fields: includeFields ? {
          select: selectFields 
            ? Object.fromEntries(selectFields.map(f => [f, true]))
            : undefined,
          orderBy: { order: 'asc' },
        } : false,
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