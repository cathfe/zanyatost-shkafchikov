import { NextResponse } from 'next/server';
import { createClient, getSession } from '@/lib/supabase/server';
import { guessNetwork, normalizeClubName } from '@/lib/match';
import type { Gender, SurfaceType } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

type ImportRow = {
  id: string;
  club_name: string;
  matched_club_id: string | null;
  city: string | null;
  address: string | null;
  surface_type: SurfaceType;
  slot: 1 | 2;
  gender: Gender | null;
  total: number | null;
  status_raw: string | null;
  periods: string[];
};

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.user || !session.isAdmin) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
  }

  const body = (await request.json()) as {
    importId?: string;
    createMissingClubs?: boolean;
    updateCapacity?: boolean;
  };

  if (!body.importId) {
    return NextResponse.json({ error: 'Не указан импорт' }, { status: 400 });
  }

  const createMissing = body.createMissingClubs !== false;
  const updateCapacity = body.updateCapacity !== false;

  const supabase = await createClient();

  const { data: imp, error: impError } = await supabase
    .from('lockers_imports')
    .select('*')
    .eq('id', body.importId)
    .maybeSingle();

  if (impError || !imp) {
    return NextResponse.json({ error: 'Импорт не найден' }, { status: 404 });
  }
  if (imp.status === 'applied') {
    return NextResponse.json({ error: 'Этот импорт уже применён' }, { status: 400 });
  }

  const { data: rowsData, error: rowsError } = await supabase
    .from('lockers_import_rows')
    .select('*')
    .eq('import_id', imp.id);

  if (rowsError) return NextResponse.json({ error: rowsError.message }, { status: 500 });

  const rows = (rowsData ?? []) as ImportRow[];
  const months: string[] = (imp.stats?.months as string[] | undefined) ?? [];

  /* --- 1. Клубы: создаём новые, дополняем город/адрес у существующих --- */

  const { data: catalog } = await supabase.from('lockers_clubs').select('id, name, network, city, address');
  const byName = new Map<string, { id: string; city: string | null; address: string | null }>();
  const knownNetworks = [
    ...new Set(((catalog ?? []) as { network: string | null }[]).map((c) => c.network).filter(Boolean) as string[]),
  ];
  ((catalog ?? []) as { id: string; name: string; city: string | null; address: string | null }[]).forEach((c) =>
    byName.set(normalizeClubName(c.name), { id: c.id, city: c.city, address: c.address }),
  );

  let createdClubs = 0;
  let enrichedClubs = 0;

  const uniqueClubs = new Map<string, ImportRow>();
  rows.forEach((r) => {
    const key = normalizeClubName(r.club_name);
    if (!uniqueClubs.has(key)) uniqueClubs.set(key, r);
  });

  for (const [key, r] of uniqueClubs) {
    const existing = byName.get(key);

    if (!existing) {
      if (!createMissing) continue;
      const { data, error } = await supabase
        .from('lockers_clubs')
        .insert({
          name: r.club_name.trim(),
          network: guessNetwork(r.club_name, knownNetworks),
          city: r.city,
          address: r.address,
          source: 'import',
        })
        .select('id')
        .single();
      if (error) continue;
      byName.set(key, { id: data.id, city: r.city, address: r.address });
      createdClubs += 1;
      continue;
    }

    // Дополняем пустые поля данными из АП, заполненные — не перетираем
    const patch: Record<string, string> = {};
    if (!existing.city && r.city) patch.city = r.city;
    if (!existing.address && r.address) patch.address = r.address;
    if (Object.keys(patch).length) {
      await supabase.from('lockers_clubs').update(patch).eq('id', existing.id);
      enrichedClubs += 1;
    }
  }

  /* --- 2. Вместимость раздевалок из колонки «Количество» --- */

  let capacityRows = 0;
  if (updateCapacity) {
    const capacity = new Map<string, { club_id: string; gender: Gender; surface_type: SurfaceType; total_lockers: number }>();
    for (const r of rows) {
      if (!r.gender || r.total == null) continue;
      const club = byName.get(normalizeClubName(r.club_name));
      if (!club) continue;
      const key = `${club.id}|${r.gender}|${r.surface_type}`;
      const prev = capacity.get(key);
      // если по клубу несколько строк — берём максимум, это вместимость раздевалки
      if (!prev || r.total > prev.total_lockers) {
        capacity.set(key, {
          club_id: club.id,
          gender: r.gender,
          surface_type: r.surface_type,
          total_lockers: r.total,
        });
      }
    }

    const list = [...capacity.values()];
    for (let i = 0; i < list.length; i += 300) {
      const { error } = await supabase
        .from('lockers_capacity')
        .upsert(list.slice(i, i + 300), { onConflict: 'club_id,gender,surface_type' });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    capacityRows = list.length;
  }

  /* --- 3. Занятость: проставляем занятые месяцы, освобождаем остальные --- */

  const occupancyUpserts: {
    club_id: string;
    month: string;
    slot: number;
    gender: Gender;
    surface_type: SurfaceType;
    occupied: number;
    campaign_label: string | null;
    import_id: string;
    updated_at: string;
  }[] = [];

  const freeKeys: { club_id: string; month: string; slot: number; gender: Gender; surface_type: SurfaceType }[] = [];

  for (const r of rows) {
    if (!r.gender) continue;
    const club = byName.get(normalizeClubName(r.club_name));
    if (!club) continue;

    const occupiedSet = new Set(r.periods ?? []);
    for (const m of months) {
      if (occupiedSet.has(m)) {
        occupancyUpserts.push({
          club_id: club.id,
          month: m,
          slot: r.slot,
          gender: r.gender,
          surface_type: r.surface_type,
          occupied: r.total ?? 0,
          campaign_label: imp.campaign_label,
          import_id: imp.id,
          updated_at: new Date().toISOString(),
        });
      } else {
        freeKeys.push({
          club_id: club.id,
          month: m,
          slot: r.slot,
          gender: r.gender,
          surface_type: r.surface_type,
        });
      }
    }
  }

  for (let i = 0; i < occupancyUpserts.length; i += 300) {
    const { error } = await supabase
      .from('lockers_occupancy')
      .upsert(occupancyUpserts.slice(i, i + 300), { onConflict: 'club_id,month,slot,gender,surface_type' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Освобождение: удаляем записи занятости там, где АП говорит «свободно».
  // Ручные правки (lockers_overrides) не трогаем — они имеют приоритет.
  let freed = 0;
  for (const k of freeKeys) {
    const { error, count } = await supabase
      .from('lockers_occupancy')
      .delete({ count: 'exact' })
      .match({
        club_id: k.club_id,
        month: k.month,
        slot: k.slot,
        gender: k.gender,
        surface_type: k.surface_type,
      });
    if (!error) freed += count ?? 0;
  }

  /* --- 4. Фиксируем импорт --- */

  const result = {
    createdClubs,
    enrichedClubs,
    capacityRows,
    occupancyRows: occupancyUpserts.length,
    freedRows: freed,
    months,
  };

  await supabase
    .from('lockers_imports')
    .update({
      status: 'applied',
      applied_at: new Date().toISOString(),
      stats: { ...imp.stats, applied: result },
    })
    .eq('id', imp.id);

  await supabase.from('lockers_admin_log').insert({
    action: 'import_applied',
    details: { file: imp.file_name, campaign: imp.campaign_label, ...result },
    actor_id: session.user.id,
    actor_email: session.user.email,
  });

  return NextResponse.json({ ok: true, ...result });
}
