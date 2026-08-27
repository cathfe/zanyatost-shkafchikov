import { notFound } from 'next/navigation';
import { ClubBoard } from '@/components/ClubBoard';
import { Shell } from '@/components/Shell';
import { createClient, getSession } from '@/lib/supabase/server';
import { currentMonthIso } from '@/lib/format';
import { cellKey, type CampaignRef, type Cell, type Gender, type Slot } from '@/lib/types';

export const dynamic = 'force-dynamic';

type StatusRow = {
  surface_type: 'lockers' | 'mirrors';
  gender: Gender;
  slot: number | null;
  status: Cell['status'];
  campaign_id: string | null;
  campaign_label: string | null;
  reason: string | null;
  source: 'ap' | 'manual';
};

export default async function ClubPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}-\d{2}$/.test(sp.month ?? '') ? sp.month! : currentMonthIso();

  const supabase = await createClient();
  const session = await getSession();

  const { data: club, error } = await supabase
    .from('lockers_clubs')
    .select('id, name, network, has_lockers, lockers_managers(name)')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return (
      <Shell mode="public" userEmail={session.user?.email ?? null} role={session.role}>
        <div className="card border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          Не удалось загрузить клуб: {error.message}
        </div>
      </Shell>
    );
  }
  if (!club) notFound();

  const rel = (club as unknown as { lockers_managers?: { name: string } | { name: string }[] | null })
    .lockers_managers;
  const managerName = (Array.isArray(rel) ? rel[0]?.name : rel?.name) ?? null;

  const [{ data: statuses }, { data: campaigns }] = await Promise.all([
    supabase
      .from('lockers_slot_status')
      .select('surface_type, gender, slot, status, campaign_id, campaign_label, reason, source')
      .eq('club_id', id)
      .eq('month', month),
    supabase
      .from('lockers_campaigns')
      .select('id, client, label, manager_id, period_start, period_end')
      .order('label'),
  ]);

  const lockers: Record<string, Cell> = {};
  const mirrors: Record<string, Cell> = {};

  ((statuses ?? []) as StatusRow[]).forEach((r) => {
    const cell: Cell = {
      status: r.status,
      campaign_id: r.campaign_id,
      campaign_label: r.campaign_label,
      reason: r.reason,
      source: r.source,
    };
    if (r.surface_type === 'lockers' && r.slot != null) {
      lockers[cellKey(r.slot as Slot, r.gender)] = cell;
    } else if (r.surface_type === 'mirrors') {
      mirrors[r.gender] = cell;
    }
  });

  return (
    <Shell mode="public" userEmail={session.user?.email ?? null} role={session.role}>
      <ClubBoard
        club={{
          id: club.id,
          name: club.name,
          network: club.network,
          managerName,
          hasLockers: club.has_lockers,
        }}
        month={month}
        lockers={lockers}
        mirrors={mirrors}
        campaigns={(campaigns ?? []) as CampaignRef[]}
        canEdit={session.canEdit}
      />
    </Shell>
  );
}
