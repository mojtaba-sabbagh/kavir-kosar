'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import ChangePasswordDialog, { ChangePasswordDialogHandle } from '@/components/ChangePasswordDialog';

export default function UserMenu({ menuWidthClass = 'w-56' }: { menuWidthClass?: string }) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const cpRef = useRef<ChangePasswordDialogHandle | null>(null);

  // Close on outside click, Esc, resize, or scroll
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    const closeOnMove = () => setOpen(false);

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('resize', closeOnMove);
    window.addEventListener('scroll', closeOnMove, { passive: true });

    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('resize', closeOnMove);
      window.removeEventListener('scroll', closeOnMove);
    };
  }, []);

  // Flip up if not enough space below
  useLayoutEffect(() => {
    if (!open) return;
    const btn = containerRef.current;
    const menu = menuRef.current;
    if (!btn || !menu) return;

    const expectedHeight = Math.min(menu.offsetHeight || 0, window.innerHeight * 0.7);
    const br = btn.getBoundingClientRect();
    const spaceBelow = window.innerHeight - br.bottom - 8;
    const spaceAbove = br.top - 8;
    setDropUp(spaceBelow < expectedHeight && spaceAbove > spaceBelow);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      {/* Keep dialog mounted outside the dropdown so it survives menu close */}
      <ChangePasswordDialog ref={cpRef} />

      {/* Kebab trigger — no border */}
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="منو"
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg p-2 text-gray-700 hover:bg-gray-100 active:scale-95 focus:outline-none focus:ring-2 focus:ring-gray-300"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="19" r="1.8" />
        </svg>
      </button>

      {/* Dropdown (no border) */}
      {open && (
        <div
          ref={menuRef}
          role="menu"
          className={`absolute right-0 z-50 ${dropUp ? 'bottom-full mb-2' : 'top-full mt-2'} ${menuWidthClass} max-w-[90vw] overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-black/5`}
          style={{ maxHeight: '70vh', overflowY: 'auto' }}
        >
          <ul className="p-1">
            <li>
              <button
                type="button"
                onClick={() => {
                  cpRef.current?.open(); // open dialog first
                  setOpen(false);        // then close menu
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                role="menuitem"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11a4 4 0 10-8 0v2h16v-2a8 8 0 10-16 0" />
                </svg>
                تغییر رمز عبور
              </button>
            </li>

            <li>
              <form action="/api/auth/logout" method="POST">
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  role="menuitem"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7v-1a3 3 0 00-3-3H6a3 3 0 00-3 3v10a3 3 0 003 3h4a3 3 0 003-3v-1" />
                  </svg>
                  خروج
                </button>
              </form>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
