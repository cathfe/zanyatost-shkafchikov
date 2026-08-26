import Link from 'next/link';
import { StatCard } from '@/components/StatCard';
import { createClient, getSession } from '@/lib/supabase/server';
import { currentMonthIso, formatDateTime, monthLabel, num } from '@/lib/format';
import type { MonthSummary } from '@/lib/types';
import { IconHistory, IconSliders, IconUpload, IconUsers } from '@/components/Icons';

export const dynamic = 'force-dynamic';

const ACTION_LABEL: Record<string, string> = {
  override_saved: 'Ручная правка занятости',
  override_cleared: 'Правка снята',
  bulk_status: 'Массовое изменение статуса',
  capacity_set: 'Изменена вместимость',
  club_created: 'Добавлен клуб',
  club_updated: 'Изменён клуб',
  club_deleted: 'Удалён клуб',
  clubs_imported: 'Импорт справочника клубов',
  import_applied: 'Применён импорт АП',
  manager_created: 'Добавлен менеджер',
  manager_updated: 'Изменён менеджер',
  access_granted: 'Выдан доступ',
  access_updated: 'Изменён доступ',
  access_revoked: 'Отозван доступ',
};

export default async function AdminOverview() {
  const month = currentMonthIso();
  const supabase = await createClient();
  const session = await getSession();

  const [
    { data: summary },
    { count: clubsCount },
    { count: manualCount },
    { count: usersCount },
    { data: log },
  ] = await Promise.all([
    supabase.rpc('lockers_month_summary', { p_month: month, p_surface: 'lockers' }),
    supabase.from('lockers_clubs').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('lockers_overrides').select('id', { count: 'exact', head: true }).eq('month', month),
    supabase.from('lockers_admins').select('user_id', { count: 'exact', head: true }),
    supabase.from('lockers_admin_log').select('*').order('created_at', { ascending: false }).limit(6),
  ]);

  const s = ((summary as MonthSummary[] | null)?.[0] ?? {
    clubs_total: 0,
    cells_total: 0,
    lockers_total: 0,
    lockers_occupied: 0,
    lockers_reserved: 0,
    lockers_free: 0,
    cells_free: 0,
    cells_occupied: 0,
    cells_reserved: 0,
    cells_closed: 0,
    cells_conflict: 0,
    cells_no_capacity: 0,
    load_percent: 0,
  }) as MonthSummary;

  const tiles = [
    {
      href: '/admin/import',
      label: 'Импорт данных',
      hint: 'Справочник клубов и адресные программы',
      icon: <IconUpload className="h-5 w-5" />,
      show: session.canEdit,
    },
    {
      href: '/lockers',
      label: 'Занятость шкафчиков',
      hint: 'Правки делаются прямо на рабочем экране',
      icon: <IconSliders className="h-5 w-5" />,
      show: true,
    },
    {
      href: '/admin/settings',
      label: 'Настройки',
      hint: 'Пользователи, роли, менеджеры',
      icon: <IconUsers className="h-5 w-5" />,
      show: session.isAdmin,
    },
  ].filter((t) => t.show);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Администрирование</h1>
        <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">
          {monthLabel(month)} · стикеры в шкафах
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Активных клубов" value={num(clubsCount ?? 0)} />
        <StatCard label="Свободных раздевалок" value={num(s.cells_free)} accent="green" />
        <StatCard label="Занято по АП" value={num(s.cells_occupied)} accent="red" />
        <StatCard
          label="Требуют разбора"
          value={num(s.cells_conflict)}
          accent={s.cells_conflict ? 'amber' : 'grey'}
          hint={`закрыто: ${s.cells_closed}`}
        />
        <StatCard label="Пользователей" value={num(usersCount ?? 0)} accent="brand" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="card flex items-start gap-3 p-4 transition-shadow hover:shadow-pop"
          >
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

      <div className="rounded-xl border border-ink-200/70 bg-ink-50/50 px-4 py-3 text-sm dark:border-white/10 dark:bg-white/5">
        Ручных правок в этом месяце: <span className="font-semibold">{num(manualCount ?? 0)}</span>.
        Они имеют приоритет над импортом и не перезаписываются при загрузке новой АП.
      </div>

      {/* Журнал — служебная информация, поэтому внизу и без акцента */}
      <details className="rounded-xl border border-ink-200/70 dark:border-white/10">
        <summary className="cursor-pointer px-4 py-2.5 text-xs font-medium text-ink-500 dark:text-ink-400">
          Последние изменения ({(log ?? []).length})
        </summary>
        <ul className="divide-y divide-ink-200/50 border-t border-ink-200/50 dark:divide-white/5 dark:border-white/5">
          {(log ?? []).length === 0 ? (
            <li className="px-4 py-3 text-xs text-ink-400">Изменений пока не было</li>
          ) : (
            (log ?? []).map(
              (e: {
                id: string;
                action: string;
                club_name: string | null;
                month: string | null;
                actor_email: string | null;
                created_at: string;
              }) => (
                <li key={e.id} className="flex items-start justify-between gap-3 px-4 py-2 text-xs">
                  <span className="text-ink-600 dark:text-ink-300">
                    {ACTION_LABEL[e.action] ?? e.action}
                    {e.club_name ? ` · ${e.club_name}` : ''}
                    {e.month ? ` · ${monthLabel(e.month)}` : ''}
                  </span>
                  <span className="shrink-0 text-ink-400">{formatDateTime(e.created_at)}</span>
                </li>
              ),
            )
          )}
        </ul>
        <div className="border-t border-ink-200/50 px-4 py-2 dark:border-white/5">
          <Link
            href="/admin/log"
            className="inline-flex items-center gap-1.5 text-xs text-ink-500 hover:text-brand-600 dark:text-ink-400"
          >
            <IconHistory className="h-3.5 w-3.5" />
            Весь журнал
          </Link>
        </div>
      </details>
    </div>
  );
}
