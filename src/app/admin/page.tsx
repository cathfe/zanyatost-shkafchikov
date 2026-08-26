import Link from 'next/link';
import { StatCard } from '@/components/StatCard';
import { createClient } from '@/lib/supabase/server';
import { currentMonthIso, formatDateTime, monthLabel, num } from '@/lib/format';
import type { MonthSummary } from '@/lib/types';
import { IconBuilding, IconHistory, IconSliders, IconUpload } from '@/components/Icons';

export const dynamic = 'force-dynamic';

const ACTION_LABEL: Record<string, string> = {
  override_saved: 'Ручная правка занятости',
  override_cleared: 'Правка снята',
  bulk_status: 'Массовое изменение статуса',
  capacity_set: 'Изменена вместимость',
  club_created: 'Добавлен клуб',
  club_updated: 'Изменён клуб',
  club_deleted: 'Удалён клуб',
  import_applied: 'Применён импорт АП',
};

export default async function AdminOverview() {
  const month = currentMonthIso();
  const supabase = await createClient();

  const [{ data: summary }, { count: clubsCount }, { count: manualCount }, { data: log }, { data: imports }] =
    await Promise.all([
      supabase.rpc('lockers_month_summary', { p_month: month, p_surface: 'lockers' }),
      supabase.from('lockers_clubs').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('lockers_overrides').select('id', { count: 'exact', head: true }).eq('month', month),
      supabase.from('lockers_admin_log').select('*').order('created_at', { ascending: false }).limit(8),
      supabase.from('lockers_imports').select('*').order('created_at', { ascending: false }).limit(5),
    ]);

  const s = ((summary as MonthSummary[] | null)?.[0] ?? {
    clubs_total: 0,
    lockers_total: 0,
    lockers_occupied: 0,
    lockers_reserved: 0,
    lockers_free: 0,
    slots_closed: 0,
    load_percent: 0,
  }) as MonthSummary;

  const tiles = [
    { href: '/admin/occupancy', label: 'Занятость', hint: 'Правки по клубам и месяцам', icon: <IconSliders className="h-5 w-5" /> },
    { href: '/admin/clubs', label: 'Клубы', hint: 'Справочник и вместимость', icon: <IconBuilding className="h-5 w-5" /> },
    { href: '/admin/import', label: 'Импорт АП', hint: 'Загрузка адресной программы', icon: <IconUpload className="h-5 w-5" /> },
    { href: '/admin/log', label: 'Журнал', hint: 'История изменений', icon: <IconHistory className="h-5 w-5" /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Обзор</h1>
        <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">
          {monthLabel(month)} · стикеры в шкафах
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Активных клубов" value={num(clubsCount ?? 0)} />
        <StatCard label="Всего шкафчиков" value={num(s.lockers_total)} hint="оба слота" />
        <StatCard label="Свободно" value={num(s.lockers_free)} accent="green" />
        <StatCard label="Загрузка" value={`${s.load_percent}%`} accent={s.load_percent > 75 ? 'red' : s.load_percent > 40 ? 'amber' : 'green'} />
        <StatCard label="Ручных правок" value={num(manualCount ?? 0)} accent="brand" hint="в этом месяце" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href} className="card flex items-start gap-3 p-4 transition-shadow hover:shadow-pop">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
              {t.icon}
            </span>
            <span>
              <span className="block text-sm font-medium">{t.label}</span>
              <span className="block text-xs text-ink-500 dark:text-ink-400">{t.hint}</span>
            </span>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card overflow-hidden">
          <div className="border-b border-ink-200/70 px-4 py-3 dark:border-white/10">
            <h2 className="text-sm font-semibold">Последние изменения</h2>
          </div>
          {(log ?? []).length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-500 dark:text-ink-400">
              Изменений пока не было
            </p>
          ) : (
            <ul className="divide-y divide-ink-200/60 dark:divide-white/5">
              {(log ?? []).map((e: { id: string; action: string; club_name: string | null; month: string | null; actor_email: string | null; created_at: string }) => (
                <li key={e.id} className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm">
                  <div>
                    <div className="font-medium">{ACTION_LABEL[e.action] ?? e.action}</div>
                    <div className="text-xs text-ink-500 dark:text-ink-400">
                      {[e.club_name, e.month ? monthLabel(e.month) : null, e.actor_email]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-ink-400">{formatDateTime(e.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-ink-200/70 px-4 py-3 dark:border-white/10">
            <h2 className="text-sm font-semibold">Импорты адресных программ</h2>
            <Link href="/admin/import" className="text-xs text-brand-600 hover:underline dark:text-brand-300">
              Загрузить
            </Link>
          </div>
          {(imports ?? []).length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-500 dark:text-ink-400">
              Ещё ни одной АП не загружено
            </p>
          ) : (
            <ul className="divide-y divide-ink-200/60 dark:divide-white/5">
              {(imports ?? []).map((i: { id: string; file_name: string; campaign_label: string | null; status: string; created_at: string; stats: Record<string, number> }) => (
                <li key={i.id} className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{i.file_name}</div>
                    <div className="text-xs text-ink-500 dark:text-ink-400">
                      {[i.campaign_label, `${i.stats?.rows ?? 0} строк`].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span
                      className={`chip ${
                        i.status === 'applied'
                          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25'
                          : 'bg-ink-100 text-ink-600 ring-ink-200 dark:bg-white/5 dark:text-ink-300 dark:ring-white/10'
                      }`}
                    >
                      {i.status === 'applied' ? 'применён' : 'черновик'}
                    </span>
                    <div className="mt-0.5 text-xs text-ink-400">{formatDateTime(i.created_at)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
