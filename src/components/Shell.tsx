'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  IconBuilding,
  IconGrid,
  IconHistory,
  IconLock,
  IconLogout,
  IconSliders,
  IconUpload,
  IconUsers,
  IconLayers,
} from './Icons';

type NavItem = { href: string; label: string; icon: React.ReactNode };

const PUBLIC_NAV: NavItem[] = [
  { href: '/', label: 'Дашборд', icon: <IconGrid /> },
  { href: '/lockers', label: 'Занятость шкафчиков', icon: <IconLayers /> },
  { href: '/overlaps', label: 'Пересечения между РК', icon: <IconSliders /> },
];

const ADMIN_NAV: NavItem[] = [
  { href: '/admin', label: 'Обзор', icon: <IconGrid /> },
  { href: '/admin/import', label: 'Импорт данных', icon: <IconUpload /> },
  { href: '/admin/manage', label: 'Ручные изменения', icon: <IconSliders /> },
  { href: '/admin/clubs', label: 'Клубы', icon: <IconBuilding /> },
  { href: '/admin/settings', label: 'Настройки', icon: <IconUsers /> },
  { href: '/admin/log', label: 'Журнал', icon: <IconHistory /> },
];

export function Shell({
  children,
  mode = 'public',
  userEmail,
  onSignOut,
}: {
  children: React.ReactNode;
  mode?: 'public' | 'admin';
  userEmail?: string | null;
  onSignOut?: () => void;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const nav = mode === 'admin' ? ADMIN_NAV : PUBLIC_NAV;

  const isActive = (href: string) =>
    href === '/' || href === '/admin' ? pathname === href : pathname.startsWith(href);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-ink-200/70 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-ink-950/85">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-4 sm:px-6">
          <Link href={mode === 'admin' ? '/admin' : '/'} className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-[13px] font-bold text-white">
              SM
            </span>
            <span className="hidden leading-tight sm:block">
              <span className="block text-sm font-semibold">Дашборд</span>
              <span className="block text-[11px] text-ink-500 dark:text-ink-400">
                {mode === 'admin' ? 'Администрирование' : 'СПОРТ МЕДИА'}
              </span>
            </span>
          </Link>

          <nav className="ml-4 hidden items-center gap-1 lg:flex">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive(item.href)
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200'
                    : 'text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-white/5'
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {mode === 'admin' ? (
              <>
                <Link href="/" className="btn-ghost hidden sm:inline-flex">
                  К дашборду
                </Link>
                <span className="hidden text-xs text-ink-500 xl:block dark:text-ink-400">{userEmail}</span>
                <button onClick={onSignOut} className="btn-ghost" title="Выйти">
                  <IconLogout />
                  <span className="hidden sm:inline">Выйти</span>
                </button>
              </>
            ) : (
              <Link href="/admin" className="btn-ghost">
                <IconLock />
                <span className="hidden sm:inline">Админка</span>
              </Link>
            )}
            <button
              className="btn-ghost lg:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label="Меню"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {open && (
          <nav className="border-t border-ink-200/70 px-4 py-2 lg:hidden dark:border-white/10">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive(item.href)
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200'
                    : 'text-ink-600 dark:text-ink-300'
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
