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
    <header className="bg-white/95 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-50 shadow-sm w-full">
      <div className="px-6 py-6">
        <div className="relative flex items-center justify-between">
          
          {/* Logo Section - Left Side */}
          <div className="flex-1 flex justify-start">
            <Link href="/" className="group shrink-0 no-underline transition-transform hover:scale-105">
              <div className="flex items-center gap-3">
                <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-50 to-indigo-100 p-2 shadow-sm ring-1 ring-blue-100 transition-all group-hover:shadow-md group-hover:ring-blue-200">
                  <Image
                    src="/logo.png"
                    alt="لوگوی کوثر کویر رفسنجان"
                    width={120}
                    height={72}
                    priority
                    className="transition-transform group-hover:scale-110"
                  />
                </div>
              </div>
            </Link>
          </div>

          {/* Title Section - Centered */}
          <div className="flex-1 flex justify-center text-center">
            <Link href="/" className="group inline-block no-underline">
              <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent leading-tight transition-all group-hover:from-blue-900 group-hover:via-blue-800 group-hover:to-blue-900">
                شرکت صنایع غذایی کوثر کویر رفسنجان
              </h1>
              <p className="text-sm md:text-base text-gray-500 mt-2 font-medium tracking-wide transition-colors group-hover:text-gray-600">
                سامانه ورود و تکمیل فرم‌های سازمانی
              </p>
            </Link>
          </div>

          {/* Navigation Section - Right Side */}
          <div className="flex-1 flex justify-end">
            <nav className="flex items-center gap-3 text-sm">
              {isAdmin && (
                <Link
                  href="/admin"
                  className="group relative overflow-hidden rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-2.5 text-white font-medium shadow-sm transition-all hover:shadow-lg hover:scale-105 active:scale-95"
                >
                  <span className="relative z-10">مدیریت</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-700 opacity-0 transition-opacity group-hover:opacity-100"></div>
                </Link>
              )}

              {user ? (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3 rounded-lg bg-gray-50/80 px-4 py-2 ring-1 ring-gray-200/50">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                      {(user.name || 'کاربر').charAt(0)}
                    </div>
                    <span className="text-gray-700 font-medium text-sm">
                      {user.name || 'کاربر'}
                    </span>
                  </div>
                  
                  <form action="/api/auth/logout" method="POST">
                    <button
                      type="submit"
                      className="group relative overflow-hidden rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-700 font-medium transition-all hover:border-gray-400 hover:bg-gray-50 hover:shadow-sm active:scale-95"
                    >
                      <span className="relative z-10 flex items-center gap-2">
                        خروج
                        <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                      </span>
                    </button>
                  </form>
                </div>
              ) : (
                <Link
                  href="/auth/sign-in"
                  className="group relative overflow-hidden rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-2.5 text-white font-medium shadow-sm transition-all hover:shadow-lg hover:scale-105 active:scale-95"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    ورود
                    <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-700 to-purple-700 opacity-0 transition-opacity group-hover:opacity-100"></div>
                </Link>
              )}
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}