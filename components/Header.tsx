import Image from 'next/image';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Header() {
  const user = await getSession();

  // check if user is admin
  let isAdmin = false;
  if (user) {
    const roles = await prisma.userRole.findMany({
      where: { userId: user.id, role: { name: 'admin' } },
    });
    isAdmin = roles.length > 0;
  }

  return (
    <header className="bg-white border-b">
      <div className="container mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-6">
        {/* Logo (left) */}
        <Link href="/" className="shrink-0 no-underline">
          <Image
            src="/logo.png"
            alt="لوگوی کوثر کویر رفسنجان"
            width={80}
            height={48}
          />
        </Link>

        {/* Title (center) */}
        <div className="flex-1 text-center">
          <Link href="/" className="inline-block no-underline">
            <h1 className="text-xl font-bold">شرکت صنایع غذایی کوثر کویر رفسنجان</h1>
            <p className="text-sm text-gray-500 mt-1">
              سامانه ورود و تکمیل فرم‌های سازمانی
            </p>
          </Link>
        </div>

        {/* Right-side nav */}
        <nav className="flex items-center gap-4 text-sm shrink-0">
          {!user ? (
            <Link
              className="no-underline hover:text-gray-700"
              href="/auth/sign-in"
            >
              ورود
            </Link>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-gray-700 font-medium">{user.name}</span>
              <form action="/api/auth/logout" method="post">
                <button className="rounded-md border px-4 py-2 hover:bg-gray-500 transition-colors">
                  خروج
                </button>
              </form>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
