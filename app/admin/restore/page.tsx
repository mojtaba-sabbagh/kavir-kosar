'use client';

import { useState } from 'react';

export default function RestorePage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.tar.gz')) {
        setMessage({
          type: 'error',
          text: 'فقط فایل‌های .tar.gz پشتیبان شده قابل بازیابی هستند',
        });
        return;
      }
      setFile(selectedFile);
      setMessage(null);
    }
  };

  const handleRestore = async () => {
    if (!file) {
      setMessage({
        type: 'error',
        text: 'لطفاً یک فایل پشتیبان انتخاب کنید',
      });
      return;
    }

    const confirmed = confirm(
      'هشدار: بازیابی پشتیبان تمام داده‌های فعلی را جایگزین خواهد کرد.\n\nآیا مطمئن هستید؟'
    );

    if (!confirmed) return;

    setLoading(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append('backup', file);

      const response = await fetch('/api/admin/restore', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'خطا در بازیابی پشتیبان');
      }

      setMessage({
        type: 'success',
        text: `بازیابی موفق: ${data.details}`,
      });

      setFile(null);
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error?.message || 'خطای نامشخصی رخ داد',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border bg-white p-6">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold mb-2">بازیابی پشتیبان</h1>
          <p className="text-gray-600">
            یک فایل پشتیبان را انتخاب کنید تا تمام داده‌های پایگاه داده و فایل‌های آپ‌لود شده بازیابی شوند.
          </p>
        </div>

        <div className="border-t pt-6">
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex gap-3">
                <span className="text-red-600 text-lg">⚠️</span>
                <div>
                  <h3 className="font-semibold text-red-900">هشدار مهم</h3>
                  <ul className="text-sm text-red-700 mt-2 space-y-1">
                    <li>• بازیابی تمام داده‌های فعلی را پاک خواهد کرد</li>
                    <li>• این عملیات برگشت‌ناپذیر است</li>
                    <li>• پیش از بازیابی، یک نسخه پشتیبان از داده‌های فعلی بگیرید</li>
                    <li>• بازیابی ممکن است چند دقیقه طول بکشد</li>
                  </ul>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                فایل پشتیبان
              </label>
              <input
                type="file"
                accept=".tar.gz,application/gzip,application/x-gzip,application/x-tar"
                onChange={handleFileSelect}
                disabled={loading}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-2">
                فقط فایل‌های .tar.gz پشتیبان شده را انتخاب کنید (مثال: backup-1403-09-21.tar.gz)
              </p>
            </div>

            {file && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <span className="font-medium">فایل انتخاب شده:</span> {file.name}
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  اندازه: {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            )}

            {message && (
              <div
                className={`p-4 rounded-lg ${
                  message.type === 'success'
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : message.type === 'warning'
                    ? 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {message.text}
              </div>
            )}

            <button
              onClick={handleRestore}
              disabled={loading || !file}
              className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                loading || !file
                  ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              {loading ? 'در حال بازیابی...' : 'شروع بازیابی'}
            </button>
          </div>
        </div>

        <div className="border-t pt-6">
          <h3 className="font-semibold mb-3 text-sm">مراحل بازیابی:</h3>
          <ol className="text-sm text-gray-600 space-y-2">
            <li>1. فایل پشتیبان را از یک مکان محفوظ دانلود کنید</li>
            <li>2. اطمینان حاصل کنید که نام فایل با .tar.gz ختم می‌شود</li>
            <li>3. فایل را در این صفحه انتخاب کنید</li>
            <li>4. روی دکمه "شروع بازیابی" کلیک کنید</li>
            <li>5. منتظر بمانید تا بازیابی تکمیل شود</li>
            <li>6. صفحه به طور خودکار تازه‌سازی خواهد شد</li>
          </ol>
        </div>

        <div className="border-t pt-6 bg-gray-50 rounded-lg p-4">
          <h3 className="font-semibold mb-3 text-sm">درباره بازیابی:</h3>
          <p className="text-sm text-gray-600">
            بازیابی فرآیند زیر را انجام می‌دهد:
          </p>
          <ul className="text-sm text-gray-600 space-y-2 mt-2">
            <li>• فایل پشتیبان را استخراج می‌کند</li>
            <li>• پایگاه داده موجود را پاک می‌کند</li>
            <li>• داده‌های پایگاه داده را از پشتیبان بازیابی می‌کند</li>
            <li>• فایل‌های آپ‌لود شده را بازیابی می‌کند</li>
            <li>• سیستم را برای استفاده آماده می‌کند</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
