import { notFound } from 'next/navigation';
import { ManagerDashboard } from '@/components/ManagerDashboard';
import { Shell } from '@/components/Shell';
import { createClient, getSession } from '@/lib/supabase/server';
import { currentMonthIso } from '@/lib/format';
import { buildCampaigns, type Placement } from '@/lib/placements';

export const dynamic = 'force-dynamic';

type RawPlacement = Omit<Placement, 'club_name' | 'network'> & {
  lockers_clubs: { name: string; network: string | null } | { name: string; network: string | null }[] | null;
};

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

  const { data: manager, error } = await supabase
    .from('lockers_managers')
    .select('id, name, slug')
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    return (
      <Shell mode="public" userEmail={session.user?.email ?? null} role={session.role}>
        <div className="card border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          Не удалось загрузить данные менеджера: {error.message}
        </div>
      </Shell>
    );
  }
  if (!manager) notFound();

  const monthEnd = (() => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(Date.UTC(y, m, 0));
    return d.toISOString().slice(0, 10);
  })();

  const [{ data: campaignRows }, { count: clubsCount }] = await Promise.all([
    supabase
      .from('lockers_campaigns')
      .select('id, client, label, period_start, period_end')
      .eq('manager_id', manager.id)
      .or(`period_start.lte.${monthEnd},period_start.is.null`)
      .order('label'),
    supabase
      .from('lockers_clubs')
      .select('id', { count: 'exact', head: true })
      .eq('manager_id', manager.id)
      .eq('is_active', true),
  ]);

  const campaigns = (campaignRows ?? []).filter(
    (c) => !c.period_end || c.period_end >= month,
  );

  const { data: placementRows } = await supabase
    .from('lockers_placements')
    .select(
      'id, campaign_id, club_id, format, status, status_detail, visit_type, assignee, photo_status, photo_due, tasks_done, note, lockers_clubs(name, network)',
    )
    .in('campaign_id', campaigns.length ? campaigns.map((c) => c.id) : ['00000000-0000-0000-0000-000000000000']);

  const placements: Placement[] = ((placementRows ?? []) as unknown as RawPlacement[]).map((p) => {
    const rel = p.lockers_clubs;
    const club = Array.isArray(rel) ? rel[0] : rel;
    return {
      ...p,
      club_name: club?.name ?? 'клуб не найден',
      network: club?.network ?? null,
    } as Placement;
  });

  return (
    <Shell mode="public" userEmail={session.user?.email ?? null} role={session.role}>
      <ManagerDashboard
        manager={{ name: manager.name, slug: manager.slug }}
        clubsCount={clubsCount ?? 0}
        campaigns={buildCampaigns(campaigns, placements)}
        month={month}
        canEdit={session.canEdit}
      />
    </Shell>
  );
}
