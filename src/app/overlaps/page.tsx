import { Suspense } from 'react';
import { OverlapsView } from '@/components/OverlapsView';
import { Shell } from '@/components/Shell';
import { createClient, getSession } from '@/lib/supabase/server';
import { currentMonthIso } from '@/lib/format';
import type { ClubOverlapRow, DismountRow, Manager } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function OverlapsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}-\d{2}$/.test(sp.month ?? '') ? sp.month! : currentMonthIso();

  const supabase = await createClient();
  const [{ data, error }, { data: dismount }, { data: managers }, session] = await Promise.all([
    supabase.rpc('lockers_club_overlaps', { p_month: month }),
    supabase.rpc('lockers_dismount_candidates', { p_month: month }),
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
          <OverlapsView
            rows={(data ?? []) as ClubOverlapRow[]}
            dismount={(dismount ?? []) as DismountRow[]}
            month={month}
            managers={(managers ?? []) as Manager[]}
            canEdit={session.canEdit}
          />
        </Suspense>
      )}
    </Shell>
  );
}
