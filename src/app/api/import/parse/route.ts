import { NextResponse } from 'next/server';
import { parseAddressProgram } from '@/lib/ap-parser';
import { createClient, getSession } from '@/lib/supabase/server';
import { normalizeClubName } from '@/lib/match';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.user || !session.isAdmin) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
  }

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Файл не передан' }, { status: 400 });
  }

  let parsed;
  try {
    parsed = await parseAddressProgram(await file.arrayBuffer(), file.name);
  } catch (e) {
    return NextResponse.json(
      { error: `Не удалось прочитать файл: ${e instanceof Error ? e.message : 'неизвестная ошибка'}` },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  // Сопоставление с каталогом клубов
  const { data: existing } = await supabase.from('lockers_clubs').select('id, name');
  const byName = new Map<string, string>();
  ((existing ?? []) as { id: string; name: string }[]).forEach((c) =>
    byName.set(normalizeClubName(c.name), c.id),
  );

  const allRows = parsed.sheets.flatMap((s) => s.rows);
  const newClubNames = [
    ...new Set(allRows.map((r) => r.clubName).filter((n) => !byName.has(normalizeClubName(n)))),
  ];

  const months = parsed.monthsDetected;

  // Ручные правки, которые пересекутся с этим импортом — их импорт не тронет
  const clubIds = [...new Set(allRows.map((r) => byName.get(normalizeClubName(r.clubName))).filter(Boolean) as string[])];
  let protectedCount = 0;
  if (clubIds.length && months.length) {
    const { count } = await supabase
      .from('lockers_overrides')
      .select('id', { count: 'exact', head: true })
      .in('club_id', clubIds)
      .in('month', months);
    protectedCount = count ?? 0;
  }

  const stats = {
    rows: allRows.length,
    sheets: parsed.sheets.length,
    clubs: new Set(allRows.map((r) => normalizeClubName(r.clubName))).size,
    newClubs: newClubNames.length,
    months,
    occupiedRows: allRows.filter((r) => r.occupiedMonths.length > 0).length,
    issues: allRows.filter((r) => r.issues.length > 0).length,
    protectedOverrides: protectedCount,
  };

  const { data: importRow, error: importError } = await supabase
    .from('lockers_imports')
    .insert({
      file_name: parsed.fileName,
      campaign_label: parsed.campaignLabel,
      period_month: months[0] ?? null,
      status: 'draft',
      column_map: Object.fromEntries(parsed.sheets.map((s) => [s.sheetName, s.headerMap])),
      stats,
      created_by: session.user.id,
    })
    .select('id')
    .single();

  if (importError) {
    return NextResponse.json({ error: importError.message }, { status: 500 });
  }

  const rowsPayload = allRows.map((r) => ({
    import_id: importRow.id,
    row_number: r.rowNumber,
    club_name: r.clubName,
    matched_club_id: byName.get(normalizeClubName(r.clubName)) ?? null,
    city: r.city,
    address: r.address,
    surface_type: r.surfaceType,
    slot: r.slot,
    gender: r.gender,
    total: r.total,
    status_raw: r.statusRaw,
    periods: r.occupiedMonths,
    issues: r.issues,
    raw: r.raw,
  }));

  for (let i = 0; i < rowsPayload.length; i += 500) {
    const { error } = await supabase.from('lockers_import_rows').insert(rowsPayload.slice(i, i + 500));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    importId: importRow.id,
    fileName: parsed.fileName,
    campaignLabel: parsed.campaignLabel,
    warnings: parsed.warnings,
    stats,
    newClubNames,
    sheets: parsed.sheets.map((s) => ({
      name: s.sheetName,
      surfaceType: s.surfaceType,
      headerRow: s.headerRow,
      headerMap: s.headerMap,
      rowCount: s.rows.length,
    })),
    preview: allRows.slice(0, 200).map((r) => ({
      clubName: r.clubName,
      matched: byName.has(normalizeClubName(r.clubName)),
      city: r.city,
      surfaceType: r.surfaceType,
      slot: r.slot,
      gender: r.gender,
      total: r.total,
      statusRaw: r.statusRaw,
      occupiedMonths: r.occupiedMonths,
      issues: r.issues,
    })),
  });
}
