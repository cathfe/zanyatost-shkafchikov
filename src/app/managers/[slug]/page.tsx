import { notFound } from 'next/navigation';
import { ManagerDashboard } from '@/components/ManagerDashboard';
import { Shell } from '@/components/Shell';
import { createClient, getSession } from '@/lib/supabase/server';
import { currentMonthIso } from '@/lib/format';
import type { PlacementRow } from '@/lib/placements';

export const dynamic = 'force-dynamic';

export default async function ManagerPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}-\d{2}$/.test(sp.month ?? '') ? sp.month! : currentMonthIso();

  const supabase = await createClient();
  const session = await getSession();

  const { data: manager, error: managerError } = await supabase
    .from('lockers_managers')
    .select('id, name, slug')
    .eq('slug', slug)
    .maybeSingle();

  // 404 только если менеджера действительно нет; сбой запроса — это другое
  if (managerError) {
    return (
      <Shell mode="public" userEmail={session.user?.email ?? null} role={session.role}>
        <div className="card border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          Не удалось загрузить данные менеджера: {managerError.message}
        </div>
      </Shell>
    );
  }
  if (!manager) notFound();

  const [{ data: rows }, { count: clubsCount }] = await Promise.all([
    supabase.rpc('lockers_manager_placements', { p_manager_slug: slug, p_month: month }),
    supabase
      .from('lockers_clubs')
      .select('id', { count: 'exact', head: true })
      .eq('manager_id', manager.id)
      .eq('is_active', true),
  ]);

  return (
    <Shell mode="public" userEmail={session.user?.email ?? null} role={session.role}>
      <ManagerDashboard
        manager={{ name: manager.name, slug: manager.slug }}
        clubsCount={clubsCount ?? 0}
        rows={(rows ?? []) as PlacementRow[]}
        month={month}
      />
    </Shell>
  );
}
