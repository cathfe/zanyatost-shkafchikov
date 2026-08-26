import { notFound } from 'next/navigation';
import { ClubDetail, type TimelinePoint } from '@/components/ClubDetail';
import { Shell } from '@/components/Shell';
import { createClient, getSession } from '@/lib/supabase/server';
import { addMonths, currentMonthIso } from '@/lib/format';
import { GENDERS, SLOTS, cellKey, type Cell, type CellStatus, type Gender, type SurfaceType } from '@/lib/types';

export const dynamic = 'force-dynamic';

type OccRow = { month: string; slot: number; gender: Gender; occupied: number; campaign_label: string | null };
type OvrRow = {
  month: string;
  slot: number;
  gender: Gender;
  status: CellStatus | null;
  total_override: number | null;
  occupied_override: number | null;
  reserved: number;
  reserved_for: string | null;
  note: string | null;
  conflict_ack: boolean;
};

export default async function ClubPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string; surface?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}-\d{2}$/.test(sp.month ?? '') ? sp.month! : currentMonthIso();
  const surface: SurfaceType = sp.surface === 'mirrors' ? 'mirrors' : 'lockers';

  const supabase = await createClient();
  const session = await getSession();

  const { data: club } = await supabase
    .from('lockers_clubs')
    .select('id, name, network, has_lockers, lockers_managers(name)')
    .eq('id', id)
    .maybeSingle();

  if (!club) notFound();

  const rel = (club as unknown as { lockers_managers?: { name: string } | { name: string }[] | null })
    .lockers_managers;
  const managerName = (Array.isArray(rel) ? rel[0]?.name : rel?.name) ?? null;

  const from = addMonths(month, -3);
  const to = addMonths(month, 8);

  const [{ data: capacity }, { data: occupancy }, { data: overrides }] = await Promise.all([
    supabase.from('lockers_capacity').select('gender, total_lockers').eq('club_id', id).eq('surface_type', surface),
    supabase
      .from('lockers_occupancy')
      .select('month, slot, gender, occupied, campaign_label')
      .eq('club_id', id)
      .eq('surface_type', surface)
      .gte('month', from)
      .lte('month', to),
    supabase
      .from('lockers_overrides')
      .select('month, slot, gender, status, total_override, occupied_override, reserved, reserved_for, note, conflict_ack')
      .eq('club_id', id)
      .eq('surface_type', surface)
      .gte('month', from)
      .lte('month', to),
  ]);

  const capMap = new Map<Gender, number | null>();
  ((capacity ?? []) as { gender: Gender; total_lockers: number | null }[]).forEach((c) =>
    capMap.set(c.gender, c.total_lockers),
  );

  const occMap = new Map<string, OccRow>();
  ((occupancy ?? []) as OccRow[]).forEach((o) => occMap.set(`${o.month}|${o.slot}|${o.gender}`, o));

  const ovrMap = new Map<string, OvrRow>();
  ((overrides ?? []) as OvrRow[]).forEach((o) => ovrMap.set(`${o.month}|${o.slot}|${o.gender}`, o));

  /** Та же логика, что в SQL-функции lockers_availability. */
  const resolve = (m: string, slot: number, gender: Gender): Cell => {
    const key = `${m}|${slot}|${gender}`;
    const ovr = ovrMap.get(key);
    const occ = occMap.get(key);

    const total = ovr?.total_override ?? capMap.get(gender) ?? null;
    const occupied = ovr?.occupied_override ?? occ?.occupied ?? 0;
    const reserved = ovr?.reserved ?? 0;

    const status: CellStatus =
      ovr?.status === 'closed'
        ? 'closed'
        : occupied > 0
          ? 'occupied'
          : reserved > 0
            ? 'reserved'
            : (ovr?.status as CellStatus | undefined) ?? 'available';

    return {
      total,
      capacity_known: total != null,
      occupied,
      reserved,
      free: total == null ? null : Math.max(total - occupied - reserved, 0),
      status,
      campaign_label: occ?.campaign_label ?? null,
      reserved_for: ovr?.reserved_for ?? null,
      note: ovr?.note ?? null,
      manual: Boolean(ovr),
      conflict: reserved > 0 && (occ?.occupied ?? 0) > 0,
      conflict_ack: ovr?.conflict_ack ?? false,
    };
  };

  const buildCells = (m: string) => {
    const out: Record<string, Cell> = {};
    for (const slot of SLOTS) for (const g of GENDERS) out[cellKey(slot, g)] = resolve(m, slot, g);
    return out;
  };

  const timeline: TimelinePoint[] = [];
  for (let i = -3; i <= 8; i++) {
    const m = addMonths(month, i);
    timeline.push({ month: m, cells: buildCells(m) });
  }

  return (
    <Shell mode="public" userEmail={session.user?.email ?? null} role={session.role}>
      {!club.has_lockers ? (
        <div className="card p-6">
          <h1 className="text-lg font-semibold">{club.name}</h1>
          <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
            В этом клубе нет шкафчиков — только экраны. Он участвует в кампаниях и заявках,
            но в разделе занятости не показывается.
          </p>
        </div>
      ) : (
        <ClubDetail
          club={{ id: club.id, name: club.name, network: club.network, managerName }}
          month={month}
          surface={surface}
          cells={buildCells(month)}
          timeline={timeline}
          canEdit={session.canEdit}
        />
      )}
    </Shell>
  );
}
