import { ClubsManager, type ClubWithCapacity } from '@/components/ClubsManager';
import { createClient } from '@/lib/supabase/server';
import type { Club, Gender, SurfaceType } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function AdminClubsPage({
  searchParams,
}: {
  searchParams: Promise<{ surface?: string }>;
}) {
  const sp = await searchParams;
  const surface: SurfaceType = sp.surface === 'mirrors' ? 'mirrors' : 'lockers';

  const supabase = await createClient();

  const [{ data: clubs }, { data: capacity }] = await Promise.all([
    supabase.from('lockers_clubs').select('*').order('name'),
    supabase.from('lockers_capacity').select('club_id, gender, total_lockers').eq('surface_type', surface),
  ]);

  const capMap = new Map<string, { male: number; female: number }>();
  ((capacity ?? []) as { club_id: string; gender: Gender; total_lockers: number }[]).forEach((c) => {
    const cur = capMap.get(c.club_id) ?? { male: 0, female: 0 };
    cur[c.gender] = c.total_lockers;
    capMap.set(c.club_id, cur);
  });

  const withCapacity: ClubWithCapacity[] = ((clubs ?? []) as Club[]).map((c) => ({
    ...c,
    male: capMap.get(c.id)?.male ?? 0,
    female: capMap.get(c.id)?.female ?? 0,
  }));

  return <ClubsManager clubs={withCapacity} surface={surface} />;
}
