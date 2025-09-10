import Image from 'next/image';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Header() {
  // Safely fetch user session
  const user = await getSession();

  // Check if user is admin
  let isAdmin = false;
  if (user?.id) {
    try {
      const roles = await prisma.userRole.findMany({
        where: { userId: user.id, role: { name: 'admin' } },
      });
      isAdmin = roles.length > 0;
    } catch (error) {
      console.error('Error fetching user roles:', error);
    }
  }

  return (
    <header className="bg-white border-b sticky top-0 z-10">
      <div className="container mx-auto max-w-5xl px-4 py-3 flex flex-col items-center gap-4 md:flex-row md:items-center md:justify-between md:gap-6">
        {/* Logo (top on mobile, left on desktop) */}
        <Link href="/" className="shrink-0 no-underline">
          <Image
            src="/logo.png"
            alt="لوگوی کوثر کویر رفسنجان"
            width={80}
            height={48}
            priority
          />
        </Link>

        {/* Title (center) */}
        <div className="text-center">
          <Link href="/" className="inline-block no-underline">
            <h1 className="text-lg md:text-xl font-bold">
              شرکت صنایع غذایی کوثر کویر رفسنجان
            </h1>
            <p className="text-xs md:text-sm text-gray-500 mt-1">
              سامانه ورود و تکمیل فرم‌های سازمانی
            </p>
          </Link>
        </div>

        {/* Right-side nav */}
        <nav className="flex items-center gap-4 text-sm">
          {isAdmin && (
            <Link
              href="/admin"
              className="rounded-md border px-4 py-2 hover:bg-gray-100 transition-colors"
            >
              مدیریت
            </Link>
          )}

          {user ? (
            <div className="flex items-center gap-3">
              <h2 className="text-gray-700 font-medium">
                {user.name || 'کاربر'}
              </h2>
              <form action="/api/auth/logout" method="POST">
                <button
                  type="submit"
                  className="rounded-md border px-4 py-2 hover:bg-gray-100 transition-colors"
                >
                  خروج
                </button>
              </form>
            </div>
          ) : (
            <Link
              className="no-underline hover:text-gray-700"
              href="/auth/sign-in"
            >
              ورود
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
