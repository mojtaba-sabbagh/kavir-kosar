'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export default function SignInPage() {
  // Wrap the hook-using client UI in Suspense to satisfy useSearchParams requirement
  return (
    <Suspense fallback={null}>
      <SignInInner />
    </Suspense>
  );
}

function SignInInner() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const sp = useSearchParams();
  const rawNext = sp.get('next') || '/';

  // Strip any segment-group names like "(protected)"
  const next = rawNext.replace(/\([^/]+\)/g, '') || '/';

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    setLoading(false);

    if (res.ok) {
      router.replace(next); // e.g. "/" or "/admin"
      router.refresh();
    } else {
      let msg = 'ورود ناموفق بود';
      try {
        const data = await res.json();
        msg = data.message || msg;
      } catch {}
      setError(msg);
    }
  };

  return (
    <div className="flex min-h-96 items-center justify-center bg-gray-100 overflow-hidden">
      <div className="w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4 text-center">ورود به سامانه</h2>
        <form
          onSubmit={onSubmit}
          className="space-y-4 bg-white p-4 rounded-2xl shadow-md max-h-[calc(100vh-200px)] overflow-auto"
        >
          <div>
            <label className="block text-sm mb-1">ایمیل</label>
            <input
              className="w-full rounded-md border px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              dir="ltr"
              placeholder="user@example.com"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">رمز عبور</label>
            <div className="relative">
              <input
                dir="ltr"
                type={showPassword ? 'text' : 'password'}
                className="w-full rounded-md border px-3 py-2 pr-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-sm text-gray-500 hover:text-gray-700"
              >
                {showPassword ? 'مخفی' : 'نمایش'}
              </button>
            </div>
          </div>

          {error && <div className="text-red-600 text-sm">{error}</div>}

          <button
            disabled={loading}
            className="w-full rounded-md bg-blue-600 text-white py-2 hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'در حال ورود...' : 'ورود'}
          </button>
        </form>
      </div>
    </div>
  );
}
