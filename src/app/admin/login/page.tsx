'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { IconLock } from '@/components/Icons';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? '/admin';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(
        error.message === 'Invalid login credentials'
          ? 'Неверная почта или пароль'
          : error.message,
      );
      setLoading(false);
      return;
    }

    router.push(next);
    router.refresh();
  };

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-brand-600 text-sm font-bold text-white">
            SM
          </span>
          <h1 className="mt-3 text-lg font-semibold">Панель управления</h1>
          <p className="text-sm text-ink-500 dark:text-ink-400">Занятость шкафчиков</p>
        </div>

        <form onSubmit={submit} className="card space-y-4 p-5">
          <div>
            <label className="label" htmlFor="email">
              Рабочая почта
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="name@company.ru"
            />
          </div>

          <div>
            <label className="label" htmlFor="password">
              Пароль
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            <IconLock />
            {loading ? 'Входим…' : 'Войти'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-ink-500 dark:text-ink-400">
          <Link href="/" className="hover:text-brand-600">
            ← Вернуться к публичной таблице
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
