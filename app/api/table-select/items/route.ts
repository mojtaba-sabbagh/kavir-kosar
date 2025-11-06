// app/api/table-select/items/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const table = searchParams.get('table');
    const type = searchParams.get('type');

    if (table !== 'fixedInformation') {
      return NextResponse.json({ 
        ok: false, 
        message: 'Only fixedInformation table is supported' 
      }, { status: 400 });
    }

    const whereClause: any = {};
    if (type) {
      whereClause.type = type;
    }

    const items = await prisma.fixedInformation.findMany({
      where: whereClause,
      select: {
        code: true,
        title: true,
        type: true,
      },
      orderBy: {
        title: 'asc',
      },
    });

    return NextResponse.json({
      ok: true,
      items,
    });
  } catch (error) {
    console.error('Error fetching table select items:', error);
    return NextResponse.json(
      { ok: false, message: 'خطا در دریافت اطلاعات' },
      { status: 500 }
    );
  }
}