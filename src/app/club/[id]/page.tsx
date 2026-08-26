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
    .select('id, name, network, city, address, is_active, note')
    .eq('id', id)
    .maybeSingle();

  if (!club) notFound();

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
  (capacity ?? []).forEach((c: { gender: Gender; total_lockers: number }) =>
    capMap.set(c.gender, c.total_lockers),
  );

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
    const status: CellStatus =
      ovr?.status ?? (total === 0 ? 'closed' : reserved > 0 ? 'reserved' : 'available');
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

  const current = SLOTS.flatMap((s) => (['male', 'female'] as Gender[]).map((g) => resolve(month, s, g)));
  const curTotal = current.reduce((a, c) => a + c.total, 0);
  const curFree = current.reduce((a, c) => a + c.free, 0);
  const curOcc = current.reduce((a, c) => a + c.occupied, 0);

  return (
    <Shell mode="public">
      <div className="space-y-5">
        <div>
          <Link
            href={`/?month=${month}&surface=${surface}`}
            className="text-sm text-ink-500 hover:text-brand-600 dark:text-ink-400"
          >
            ← Ко всем клубам
          </Link>
          <h1 className="mt-2 text-xl font-semibold tracking-tight">{club.name}</h1>
          <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">
            {[club.network, club.city, club.address].filter(Boolean).join(' · ') || 'Адрес не заполнен'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Всего шкафчиков" value={num(curTotal)} hint={`${monthLabel(month)}, оба слота`} />
          <StatCard label="Свободно" value={num(curFree)} accent="green" hint={`${pct(curFree, curTotal)}%`} />
          <StatCard label="Занято" value={num(curOcc)} accent="red" hint={`${pct(curOcc, curTotal)}%`} />
          <StatCard
            label="Вместимость"
            value={`${num(capMap.get('male') ?? 0)} / ${num(capMap.get('female') ?? 0)}`}
            hint="мужская / женская"
          />
        </div>

        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-200/70 px-4 py-3 dark:border-white/10">
            <div>
              <h2 className="text-sm font-semibold">Занятость по месяцам</h2>
              <p className="text-xs text-ink-500 dark:text-ink-400">{SURFACE_LABEL[surface]}</p>
            </div>
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
                              className={`rounded-md px-1.5 py-1 text-center text-xs ring-1 ring-inset ${TONE_CLASS[tone]} ${
                                m === month ? 'ring-2 ring-brand-400/60' : ''
                              }`}
                              title={[
                                monthLabel(m),
                                c.status === 'closed' ? 'закрыто' : `свободно ${c.free} из ${c.total}`,
                                c.campaign ? `кампания: ${c.campaign}` : null,
                                c.note,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            >
                              {c.status === 'closed' ? '×' : c.free}
                              {c.manual && <span className="ml-0.5 text-[9px] opacity-70">✎</span>}
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

        {club.note && (
          <div className="card p-4 text-sm">
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-500">Примечание</div>
            {club.note}
          </div>
        )}
      </div>
    </Shell>
  );
}
