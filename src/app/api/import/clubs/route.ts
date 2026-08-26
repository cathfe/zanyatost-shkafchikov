import { NextResponse } from 'next/server';
import { parseClubsFile, validateClubs, type ParsedClubRow } from '@/lib/clubs-parser';
import { createClient, getSession } from '@/lib/supabase/server';
import { normalizeClubName } from '@/lib/match';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .split('')
    .map((ch) => MAP[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Импорт справочника клубов.
 *
 * `dryRun` — только разбор и проверки, в базу ничего не пишется.
 * Без `dryRun` импорт выполняется, но лишь если проверки прошли:
 * при дубликатах, потерянных строках или несовпадении контрольного
 * количества запись не начинается вовсе.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session.user || !session.canEdit) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
  }

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Файл не передан' }, { status: 400 });
  }

  const dryRun = String(form.get('dryRun') ?? 'true') === 'true';
  const expectedRaw = String(form.get('expectedCount') ?? '318').trim();
  const expectedCount = expectedRaw === '' ? null : Number(expectedRaw);
  const deactivateMissing = String(form.get('deactivateMissing') ?? 'true') === 'true';

  if (expectedCount != null && !Number.isFinite(expectedCount)) {
    return NextResponse.json({ error: 'Контрольное количество должно быть числом' }, { status: 400 });
  }

  let parsed;
  try {
    parsed = await parseClubsFile(await file.arrayBuffer(), file.name);
  } catch (e) {
    return NextResponse.json(
      { error: `Не удалось прочитать файл: ${e instanceof Error ? e.message : 'неизвестная ошибка'}` },
      { status: 400 },
    );
  }

  const errors = validateClubs(parsed, expectedCount);

  const supabase = await createClient();

  const { data: existingClubs } = await supabase.from('lockers_clubs').select('id, name, manager_id');
  const existingByName = new Map<string, { id: string; manager_id: string | null }>();
  ((existingClubs ?? []) as { id: string; name: string; manager_id: string | null }[]).forEach((c) =>
    existingByName.set(normalizeClubName(c.name), { id: c.id, manager_id: c.manager_id }),
  );

  const newClubs = parsed.rows.filter((r) => !existingByName.has(normalizeClubName(r.club)));
  const fileNames = new Set(parsed.rows.map((r) => normalizeClubName(r.club)));
  const missingFromFile = ((existingClubs ?? []) as { id: string; name: string }[]).filter(
    (c) => !fileNames.has(normalizeClubName(c.name)),
  );

  const summary = {
    fileName: parsed.fileName,
    totalRows: parsed.totalRows,
    uniqueClubs: parsed.uniqueClubs,
    expectedCount,
    duplicates: parsed.duplicates,
    skippedRows: parsed.skippedRows,
    missingManager: parsed.missingManager,
    managers: parsed.managers,
    hasNetworkColumn: parsed.hasNetworkColumn,
    newClubs: newClubs.map((r) => r.club),
    missingFromFile: missingFromFile.map((c) => c.name),
    errors,
  };

  if (dryRun) {
    return NextResponse.json({ ok: errors.length === 0, dryRun: true, ...summary });
  }

  if (errors.length) {
    return NextResponse.json({ ok: false, dryRun: false, ...summary }, { status: 400 });
  }

  /* --- Менеджеры --- */
  const { data: managerRows } = await supabase.from('lockers_managers').select('id, name');
  const managerByName = new Map<string, string>();
  ((managerRows ?? []) as { id: string; name: string }[]).forEach((m) =>
    managerByName.set(m.name.trim().toLowerCase(), m.id),
  );

  const neededManagers = [...new Set(parsed.rows.map((r) => r.manager).filter(Boolean) as string[])];
  let createdManagers = 0;

  for (const name of neededManagers) {
    if (managerByName.has(name.trim().toLowerCase())) continue;
    const { data, error } = await supabase
      .from('lockers_managers')
      .insert({ name: name.trim(), slug: slugify(name) })
      .select('id')
      .single();
    if (error) continue;
    managerByName.set(name.trim().toLowerCase(), data.id);
    createdManagers += 1;
  }

  /* --- Клубы --- */
  let created = 0;
  let updated = 0;

  const chunk = <T,>(arr: T[], size: number): T[][] => {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

  const toInsert: { name: string; manager_id: string | null; network: string | null; source: string }[] = [];
  const toUpdate: { id: string; manager_id: string | null; network: string | null }[] = [];

  for (const row of parsed.rows as ParsedClubRow[]) {
    const managerId = row.manager ? managerByName.get(row.manager.trim().toLowerCase()) ?? null : null;
    const existing = existingByName.get(normalizeClubName(row.club));
    if (existing) {
      toUpdate.push({ id: existing.id, manager_id: managerId, network: row.network });
    } else {
      toInsert.push({
        name: row.club.trim(),
        manager_id: managerId,
        network: row.network,
        source: 'import',
      });
    }
  }

  for (const batch of chunk(toInsert, 200)) {
    const { error, count } = await supabase
      .from('lockers_clubs')
      .insert(batch, { count: 'exact' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    created += count ?? batch.length;
  }

  for (const row of toUpdate) {
    const patch: Record<string, unknown> = { manager_id: row.manager_id, is_active: true, updated_at: new Date().toISOString() };
    if (row.network) patch.network = row.network;
    const { error } = await supabase.from('lockers_clubs').update(patch).eq('id', row.id);
    if (!error) updated += 1;
  }

  /* --- Клубы, которых нет в файле --- */
  let deactivated = 0;
  if (deactivateMissing && missingFromFile.length) {
    const { error, count } = await supabase
      .from('lockers_clubs')
      .update({ is_active: false, updated_at: new Date().toISOString() }, { count: 'exact' })
      .in(
        'id',
        missingFromFile.map((c) => c.id),
      );
    if (!error) deactivated = count ?? missingFromFile.length;
  }

  /* --- Итоговая сверка --- */
  const { count: activeCount } = await supabase
    .from('lockers_clubs')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);

  const result = {
    created,
    updated,
    deactivated,
    createdManagers,
    activeClubs: activeCount ?? 0,
    matchesExpected: expectedCount == null || activeCount === expectedCount,
  };

  await supabase.from('lockers_imports').insert({
    file_name: parsed.fileName,
    campaign_label: 'Справочник клубов',
    status: 'applied',
    applied_at: new Date().toISOString(),
    stats: { kind: 'clubs', rows: parsed.totalRows, unique: parsed.uniqueClubs, ...result },
    created_by: session.user.id,
  });

  await supabase.from('lockers_admin_log').insert({
    action: 'clubs_imported',
    details: { file: parsed.fileName, ...result },
    actor_id: session.user.id,
    actor_email: session.user.email,
  });

  return NextResponse.json({ ok: true, dryRun: false, ...summary, ...result });
}
