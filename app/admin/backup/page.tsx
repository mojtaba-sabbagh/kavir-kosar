'use client';

import { useState } from 'react';
import { formatJalali } from '@/lib/date-utils';

export default function BackupPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleBackup = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/backup', {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'خطا در ایجاد پشتیبان');
      }

      // Get the blob from response
      const blob = await response.blob();
      
      // Create download link with Jalali date
      const jalaliDate = formatJalali(new Date()).replace(/\//g, '-');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-${jalaliDate}.tar.gz`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setMessage({
        type: 'success',
        text: 'پشتیبان‌گیری با موفقیت انجام شد و دانلود آغاز شد',
      });
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
          <h1 className="text-2xl font-semibold mb-2">پشتیبان‌گیری</h1>
          <p className="text-gray-600">
            یک فایل پشتیبان شامل تمام داده‌های پایگاه داده و فایل‌های آپ‌لود شده را ایجاد و دانلود کنید.
          </p>
        </div>

        <div className="border-t pt-6">
          <h2 className="text-lg font-semibold mb-4">اطلاعات پشتیبان‌گیری</h2>
          <div className="space-y-3 mb-6 text-sm">
            <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
              <span className="text-blue-600 mt-0.5">ℹ️</span>
              <div>
                <div className="font-medium text-blue-900">پایگاه داده PostgreSQL</div>
                <div className="text-blue-700 text-xs mt-1">تمام جداول و داده‌های پایگاه داده</div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
              <span className="text-blue-600 mt-0.5">📁</span>
              <div>
                <div className="font-medium text-blue-900">فایل‌های آپ‌لود شده</div>
                <div className="text-blue-700 text-xs mt-1">تمام فایل‌هایی که کاربران آپ‌لود کرده‌اند</div>
              </div>
            </div>
          </div>

          {message && (
            <div
              className={`p-4 rounded-lg mb-6 ${
                message.type === 'success'
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {message.text}
            </div>
          )}

          <button
            onClick={handleBackup}
            disabled={loading}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
              loading
                ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {loading ? 'در حال ایجاد پشتیبان...' : 'ایجاد و دانلود پشتیبان'}
          </button>
        </div>

        <div className="border-t pt-6">
          <h3 className="font-semibold mb-3 text-sm">نکات مهم:</h3>
          <ul className="text-sm text-gray-600 space-y-2">
            <li>• هر پشتیبان‌گیری تمام داده‌های فعلی سامانه را شامل می‌شود</li>
            <li>• فایل پشتیبان در قالب compressed (.tar.gz) ذخیره می‌شود</li>
            <li>• می‌توانید این فایل را برای احتیاط و بازیابی در صورت نیاز محفوظ نگاه دارید</li>
            <li>• پشتیبان‌گیری ممکن است چند دقیقه طول بکشد</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
