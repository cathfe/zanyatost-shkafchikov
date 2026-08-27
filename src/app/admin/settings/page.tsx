import Link from 'next/link';
import { SettingsManager } from '@/components/SettingsManager';
import { createClient, getSession } from '@/lib/supabase/server';
import type { AppUser, Manager } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  const session = await getSession();

  if (!session.isAdmin) {
    return (
      <div className="card p-6">
        <h1 className="text-lg font-semibold">Раздел доступен администраторам</h1>
        <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
          Управление пользователями и менеджерами доступно только с ролью «Администратор».
        </p>
        <Link href="/admin" className="btn-ghost mt-4">
          К обзору
        </Link>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: users }, { data: managers }] = await Promise.all([
    supabase.from('lockers_admins').select('*').order('created_at'),
    supabase.from('lockers_managers').select('*').order('name'),
  ]);

  return (
    <SettingsManager
      users={(users ?? []) as AppUser[]}
      managers={(managers ?? []) as Manager[]}
      currentUserId={session.user!.id}
    />
  );
}
