import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { Legend } from '@/components/Legend';
import { StatCard } from '@/components/StatCard';
import { createClient } from '@/lib/supabase/server';
import { addMonths, currentMonthIso, monthLabel, monthShort, num, pct, TONE_CLASS, toneFor } from '@/lib/format';
import { GENDER_LABEL, SLOTS, SURFACE_LABEL, type CellStatus, type Gender, type SurfaceType } from '@/lib/types';

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
  note: string | null;
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

  const { data: club } = await supabase
    .from('lockers_clubs')
    .select('id, name, network, is_active, manager_id, lockers_managers(name)')
    .eq('id', id)
    .maybeSingle();

  if (!club) notFound();

  const rel = (club as unknown as { lockers_managers?: { name: string } | { name: string }[] | null })
    .lockers_managers;
  const managerName = Array.isArray(rel) ? rel[0]?.name : rel?.name;

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
      .select('month, slot, gender, status, total_override, occupied_override, reserved, note')
      .eq('club_id', id)
      .eq('surface_type', surface)
      .gte('month', from)
      .lte('month', to),
  ]);

  const capMap = new Map<Gender, number>();
  (capacity ?? []).forEach((c: { gender: Gender; total_lockers: number }) => capMap.set(c.gender, c.total_lockers));

  const occMap = new Map<string, OccRow>();
  ((occupancy ?? []) as OccRow[]).forEach((o) => occMap.set(`${o.month}|${o.slot}|${o.gender}`, o));

  const ovrMap = new Map<string, OvrRow>();
  ((overrides ?? []) as OvrRow[]).forEach((o) => ovrMap.set(`${o.month}|${o.slot}|${o.gender}`, o));

  const months: string[] = [];
  for (let i = -3; i <= 8; i++) months.push(addMonths(month, i));

  const resolve = (m: string, slot: number, gender: Gender) => {
    const key = `${m}|${slot}|${gender}`;
    const ovr = ovrMap.get(key);
    const occ = occMap.get(key);
    const total = ovr?.total_override ?? capMap.get(gender) ?? 0;
    const occupied = Math.min(ovr?.occupied_override ?? occ?.occupied ?? 0, total);
    const reserved = ovr?.reserved ?? 0;
    const free = Math.max(total - occupied - reserved, 0);
    const status: CellStatus = ovr?.status ?? (total === 0 ? 'closed' : reserved > 0 ? 'reserved' : 'available');
    return {
      total,
      occupied,
      reserved,
      free,
      status,
      note: ovr?.note ?? null,
      campaign: occ?.campaign_label ?? null,
      manual: Boolean(ovr),
    };
  };

  const current = SLOTS.flatMap((s) =>
    (['male', 'female'] as Gender[]).map((g) => ({ slot: s, gender: g, ...resolve(month, s, g) })),
  );
  const open = current.filter((c) => c.status !== 'closed');
  const curTotal = open.reduce((a, c) => a + c.total, 0);
  const curFree = open.reduce((a, c) => a + c.free, 0);
  const curOcc = open.reduce((a, c) => a + c.occupied, 0);
  const closedCount = current.length - open.length;

  return (
    <Shell mode="public">
      <div className="space-y-5">
        <div>
          <Link
            href={`/lockers?month=${month}&surface=${surface}`}
            className="text-sm text-ink-500 hover:text-brand-600 dark:text-ink-400"
          >
            ← К занятости
          </Link>
          <h1 className="mt-2 text-xl font-semibold tracking-tight">{club.name}</h1>
          <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">
            {[club.network, managerName].filter(Boolean).join(' · ') || '—'} · {monthLabel(month)} ·{' '}
            {SURFACE_LABEL[surface]}
          </p>
        </div>

        {closedCount > 0 && (
          <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
            <span className="font-semibold">
              {closedCount === 4
                ? 'Клуб закрыт для размещения в этом месяце'
                : `Закрытых раздевалок в этом месяце: ${closedCount} из 4`}
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Всего шкафчиков" value={num(curTotal)} hint="по открытым раздевалкам" />
          <StatCard label="Свободно" value={num(curFree)} accent="green" hint={`${pct(curFree, curTotal)}%`} />
          <StatCard label="Занято" value={num(curOcc)} accent="red" hint={`${pct(curOcc, curTotal)}%`} />
          <StatCard
            label="Закрыто"
            value={`${closedCount} / 4`}
            accent={closedCount ? 'red' : 'grey'}
            hint="раздевалок"
          />
        </div>

        {/* Четыре раздевалки текущего месяца крупно */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {current.map((c) => (
            <div
              key={`${c.slot}-${c.gender}`}
              className={`card overflow-hidden ${
                c.status === 'closed' ? 'border-rose-300 dark:border-rose-500/40' : ''
              }`}
            >
              <div
                className={`px-4 py-2.5 text-sm font-semibold ${
                  c.status === 'closed'
                    ? 'bg-rose-600 text-white'
                    : 'border-b border-ink-200/70 dark:border-white/10'
                }`}
              >
                Слот {c.slot} · {GENDER_LABEL[c.gender]}
              </div>

              {c.status === 'closed' ? (
                /* У закрытой раздевалки цифры не показываем — только статус и причина */
                <div className="px-4 py-4">
                  <div className="text-xs uppercase tracking-wide text-ink-500 dark:text-ink-400">Статус</div>
                  <div className="mt-1 flex items-center gap-2 text-base font-bold text-rose-600 dark:text-rose-400">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-600" />
                    Закрыта
                  </div>

                  <div className="mt-4 text-xs uppercase tracking-wide text-ink-500 dark:text-ink-400">
                    Комментарий
                  </div>
                  <p className="mt-1 text-sm">
                    {c.note ?? <span className="text-ink-400">причина не указана</span>}
                  </p>
                </div>
              ) : (
                <div className="px-4 py-4">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-semibold tabular-nums">{c.free}</span>
                    <span className="text-sm text-ink-500 dark:text-ink-400">свободно из {c.total}</span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-100 dark:bg-white/10">
                    <div
                      className="h-full rounded-full bg-brand-500"
                      style={{ width: `${c.total ? Math.round(((c.occupied + c.reserved) / c.total) * 100) : 0}%` }}
                    />
                  </div>
                  <dl className="mt-3 space-y-1 text-xs">
                    <Row label="Занято" value={num(c.occupied)} />
                    {c.reserved > 0 && <Row label="Бронь" value={num(c.reserved)} />}
                    {c.campaign && <Row label="Проект" value={c.campaign} />}
                    {c.note && <Row label="Примечание" value={c.note} />}
                  </dl>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-200/70 px-4 py-3 dark:border-white/10">
            <h2 className="text-sm font-semibold">Занятость по месяцам</h2>
            <Legend />
          </div>

          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead className="bg-ink-50/60 dark:bg-white/5">
                <tr>
                  <th className="th sticky left-0 z-10 bg-ink-50/95 dark:bg-ink-900/95">Слот / раздевалка</th>
                  {months.map((m) => (
                    <th
                      key={m}
                      className={`th text-center ${m === month ? 'text-brand-600 dark:text-brand-300' : ''}`}
                    >
                      {monthShort(m)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-200/60 dark:divide-white/5">
                {SLOTS.flatMap((slot) =>
                  (['male', 'female'] as Gender[]).map((gender) => (
                    <tr key={`${slot}-${gender}`}>
                      <td className="td sticky left-0 z-10 whitespace-nowrap bg-white font-medium dark:bg-ink-900">
                        Слот {slot} · {GENDER_LABEL[gender]}
                      </td>
                      {months.map((m) => {
                        const c = resolve(m, slot, gender);
                        const tone = toneFor(c.status, c.free, c.total);
                        return (
                          <td key={m} className="td px-1.5 py-1.5">
                            <div
                              className={`rounded-md px-1.5 py-1 text-center text-xs font-medium ring-1 ring-inset ${TONE_CLASS[tone]} ${
                                m === month ? 'ring-2 ring-brand-400/60' : ''
                              }`}
                              title={[
                                monthLabel(m),
                                c.status === 'closed' ? 'закрыта' : `свободно ${c.free} из ${c.total}`,
                                c.campaign ? `проект: ${c.campaign}` : null,
                                c.note,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            >
                              {c.status === 'closed' ? 'закр.' : c.free}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-ink-500 dark:text-ink-400">{label}</dt>
      <dd className="truncate text-right font-medium">{value}</dd>
    </div>
  );
}
