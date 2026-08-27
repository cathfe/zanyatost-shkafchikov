import { Suspense } from 'react';
import { Shell } from '@/components/Shell';
import { SurfaceBoard } from '@/components/SurfaceBoard';
import { getSession } from '@/lib/supabase/server';
import { loadBoard } from '@/lib/board';
import { currentMonthIso } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function LockersPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}-\d{2}$/.test(sp.month ?? '') ? sp.month! : currentMonthIso();

  const [{ error, clubs, managers, campaigns }, session] = await Promise.all([
    loadBoard(month, 'lockers'),
    getSession(),
  ]);

  return (
    <Shell mode="public" userEmail={session.user?.email ?? null} role={session.role}>
      {error ? (
        <div className="card border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          Не удалось загрузить данные: {error.message}
        </div>
      ) : (
        <Suspense fallback={<div className="text-sm text-ink-500">Загрузка…</div>}>
          <SurfaceBoard
            clubs={clubs}
            month={month}
            surface="lockers"
            managers={managers}
            campaigns={campaigns}
            canEdit={session.canEdit}
          />
        </Suspense>
      )}
    </Shell>
  );
}
