import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/auth';


export async function POST() {
    destroySession();
    return NextResponse.redirect(new URL('/auth/sign-in', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5000'));
}