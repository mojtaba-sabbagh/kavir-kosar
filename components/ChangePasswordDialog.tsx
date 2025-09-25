// components/ChangePasswordDialog.tsx
'use client';

import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { createPortal } from 'react-dom';

export type ChangePasswordDialogHandle = { open: () => void; close: () => void };

type Props = { size?: 'sm' | 'md'; buttonClassName?: string };

const ChangePasswordDialog = forwardRef<ChangePasswordDialogHandle, Props>(function ChangePasswordDialog(
  { size = 'md', buttonClassName },
  ref
) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false); // avoid SSR mismatch for portal
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [details, setDetails] = useState<string[]>([]);

  useEffect(() => setMounted(true), []);

  const reset = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setMsg(null);
    setErr(null);
    setDetails([]);
  };

  const openDialog = () => {
    reset();
    setOpen(true);
  };

  useImperativeHandle(ref, () => ({
    open: openDialog,
    close: () => setOpen(false),
  }));

  const btnBase =
    'group relative overflow-hidden rounded-lg border bg-white font-medium transition-all hover:shadow-sm active:scale-95';
  const btnSize =
    size === 'sm'
      ? 'px-3 py-2 text-xs border-gray-300 hover:border-gray-400'
      : 'px-4 py-2.5 text-sm border-gray-300 hover:border-gray-400';

  return (
    <>
      {/* Optional default trigger */}
      {buttonClassName && (
        <button type="button" onClick={openDialog} className={`${btnBase} ${btnSize} ${buttonClassName}`}>
          <span className="relative z-10 flex items-center gap-2">
            تغییر رمز
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0-1.657-1.343-3-3-3S6 9.343 6 11v2h12v-2a6 6 0 10-12 0" />
            </svg>
          </span>
        </button>
      )}

      {/* PORTAL ensures true viewport-centering */}
      {mounted && open
        ? createPortal(
            <div
              className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
            >
              <div
                className="absolute inset-0 bg-black/40"
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
              />
              <div className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-xl ring-1 ring-gray-200 max-h-[90vh] overflow-auto">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-gray-900">تغییر رمز عبور</h3>
                  <button
                    onClick={() => {
                      setOpen(false);
                      reset();
                    }}
                    className="rounded-md p-1 text-gray-500 hover:bg-gray-100"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setLoading(true);
                    setMsg(null);
                    setErr(null);
                    setDetails([]);
                    try {
                      const res = await fetch('/api/auth/change-password', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ currentPassword, newPassword, confirmNewPassword }),
                      });
                      const data = await res.json();
                      if (!res.ok) {
                        setErr(data?.message || 'خطا در تغییر رمز عبور.');
                        setDetails(Array.isArray(data?.details) ? data.details : []);
                      } else {
                        setMsg(data?.message || 'رمز عبور با موفقیت تغییر کرد.');
                        setTimeout(() => {
                          setOpen(false);
                          reset();
                        }, 1200);
                      }
                    } catch {
                      setErr('خطای غیرمنتظره. لطفاً دوباره تلاش کنید.');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">رمز فعلی</label>
                    <input
                      type="password"
                      autoComplete="current-password"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="رمز فعلی را وارد کنید"
                    />
                    <p className="mt-1 text-xs text-gray-500">اگر قبلاً رمز نداشتید، این کادر را خالی بگذارید.</p>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">رمز جدید</label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="حداقل ۸ کاراکتر، شامل حروف بزرگ/کوچک و عدد"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">تکرار رمز جدید</label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="تکرار رمز جدید"
                      required
                    />
                  </div>

                  {err && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      <div className="font-medium">{err}</div>
                      {details?.length > 0 && (
                        <ul className="mt-1 list-inside list-disc space-y-0.5">
                          {details.map((d, i) => (
                            <li key={i}>{d}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {msg && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                      {msg}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        reset();
                      }}
                      className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      انصراف
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-70"
                    >
                      {loading ? 'در حال ذخیره…' : 'ذخیره'}
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
});

export default ChangePasswordDialog;
