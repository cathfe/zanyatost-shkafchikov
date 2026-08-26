import Link from 'next/link';
import { AdminShell } from '@/components/AdminShell';
import { getSession } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin } = await getSession();

  // Неавторизованных на /admin/login отправляет middleware — здесь просто отдаём форму.
  if (!user) return <>{children}</>;

  if (!isAdmin) {
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <div className="card max-w-md p-6 text-center">
          <h1 className="text-lg font-semibold">Доступ не выдан</h1>
          <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
            Вы вошли как <span className="font-medium">{user.email}</span>, но эта учётная запись не
            добавлена в администраторы панели.
          </p>
          <p className="mt-3 rounded-lg bg-ink-50 px-3 py-2 text-left font-mono text-xs dark:bg-white/5">
            insert into lockers_admins (user_id, email)
            <br />
            values (&apos;{user.id}&apos;, &apos;{user.email}&apos;);
          </p>
          <Link href="/" className="btn-ghost mt-4">
            На публичную часть
          </Link>
        </div>
      </div>
    );
  }

  return <AdminShell userEmail={user.email ?? null}>{children}</AdminShell>;
}
