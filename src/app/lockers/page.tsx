import { Suspense } from 'react';
import { OccupancyExplorer } from '@/components/OccupancyExplorer';
import { Shell } from '@/components/Shell';
import { createClient, getSession } from '@/lib/supabase/server';
import { currentMonthIso } from '@/lib/format';
import type { AvailabilityRow, Manager, SurfaceType } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function LockersPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; surface?: string }>;
}) {
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}-\d{2}$/.test(sp.month ?? '') ? sp.month! : currentMonthIso();
  const surface: SurfaceType = sp.surface === 'mirrors' ? 'mirrors' : 'lockers';

  const supabase = await createClient();
  const [{ data, error }, { data: managers }, session] = await Promise.all([
    supabase.rpc('lockers_availability', { p_month: month, p_surface: surface }),
    supabase.from('lockers_managers').select('*').eq('is_active', true).order('name'),
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
          <OccupancyExplorer
            rows={(data ?? []) as AvailabilityRow[]}
            month={month}
            surface={surface}
            managers={(managers ?? []) as Manager[]}
            canEdit={session.canEdit}
          />
        </Suspense>
      )}
    </Shell>
  );
}
