import Link from 'next/link';
import { Shell } from '@/components/Shell';
import { createClient } from '@/lib/supabase/server';
import { currentMonthIso, monthLabel, num } from '@/lib/format';
import type { Manager, MonthSummary } from '@/lib/types';
import { IconArrowRight, IconLayers, IconSliders, IconUsers } from '@/components/Icons';

export const dynamic = 'force-dynamic';

export default async function DashboardHome() {
  const month = currentMonthIso();
  const supabase = await createClient();

  const [{ data: summary }, { data: managers }, { data: clubRows }] = await Promise.all([
    supabase.rpc('lockers_month_summary', { p_month: month, p_surface: 'lockers' }),
    supabase.from('lockers_managers').select('*').eq('is_active', true).order('name'),
    supabase.from('lockers_clubs').select('manager_id').eq('is_active', true),
  ]);

  const s = (summary as MonthSummary[] | null)?.[0];
  const clubsByManager = new Map<string, number>();
  ((clubRows ?? []) as { manager_id: string | null }[]).forEach((c) => {
    if (!c.manager_id) return;
    clubsByManager.set(c.manager_id, (clubsByManager.get(c.manager_id) ?? 0) + 1);
  });
  const clubsTotal = (clubRows ?? []).length;

  return (
    <Shell mode="public">
      <div className="space-y-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Дашборд</h1>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
            Внутренние разделы СПОРТ МЕДИА · {monthLabel(month)} · {num(clubsTotal)} клубов в системе
          </p>
        </header>

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">
            Размещения
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <SectionCard
              href="/lockers"
              title="Занятость шкафчиков"
              description="Свободные и занятые шкафчики по клубам, месяцам, слотам и раздевалкам"
              icon={<IconLayers className="h-5 w-5" />}
              stats={
                s
                  ? [
                      { label: 'Свободно', value: num(s.lockers_free) },
                      { label: 'Занято', value: num(s.lockers_occupied) },
                      { label: 'Загрузка', value: `${s.load_percent}%` },
                    ]
                  : []
              }
            />
            <SectionCard
              href="/overlaps"
              title="Пересечения между РК"
              description="Где слот 1 и слот 2 одной раздевалки заняты разными проектами одновременно"
              icon={<IconSliders className="h-5 w-5" />}
              accent="amber"
            />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">
            Дашборды менеджеров
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {((managers ?? []) as Manager[]).map((m) => (
              <Link
                key={m.id}
                href={`/managers/${m.slug}`}
                className="card group flex flex-col p-5 transition-shadow hover:shadow-pop"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
                    {initials(m.name)}
                  </span>
                  <IconArrowRight className="h-4 w-4 text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-500" />
                </div>
                <div className="mt-3 text-base font-semibold">{m.name}</div>
                <p className="mt-1 flex-1 text-sm text-ink-500 dark:text-ink-400">
                  Заявки на размещение, кампании и бюджеты
                </p>
                <div className="mt-4 flex items-center justify-between border-t border-ink-200/70 pt-3 text-xs dark:border-white/10">
                  <span className="text-ink-500 dark:text-ink-400">Клубов в ведении</span>
                  <span className="font-semibold tabular-nums">{num(clubsByManager.get(m.id) ?? 0)}</span>
                </div>
              </Link>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-500 dark:text-ink-400">
            Дашборды менеджеров пока работают на демонстрационных данных. Архитектура готова
            к подключению корпоративной базы — источник переключается одной настройкой.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">
            Служебное
          </h2>
          <Link
            href="/admin"
            className="card flex items-center gap-3 p-4 transition-shadow hover:shadow-pop sm:w-1/2"
          >
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-ink-100 text-ink-600 dark:bg-white/5 dark:text-ink-300">
              <IconUsers className="h-5 w-5" />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-medium">Администрирование</span>
              <span className="block text-xs text-ink-500 dark:text-ink-400">
                Импорт данных, ручные изменения, клубы, пользователи
              </span>
            </span>
            <IconArrowRight className="h-4 w-4 text-ink-300" />
          </Link>
        </section>
      </div>
    </Shell>
  );
}

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

function SectionCard({
  href,
  title,
  description,
  icon,
  stats = [],
  accent,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  stats?: { label: string; value: string }[];
  accent?: 'amber';
}) {
  return (
    <Link href={href} className="card group flex flex-col p-5 transition-shadow hover:shadow-pop">
      <div className="flex items-start justify-between gap-3">
        <span
          className={`grid h-10 w-10 place-items-center rounded-lg ${
            accent === 'amber'
              ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300'
              : 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300'
          }`}
        >
          {icon}
        </span>
        <IconArrowRight className="h-4 w-4 text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-500" />
      </div>

      <div className="mt-3 text-base font-semibold">{title}</div>
      <p className="mt-1 flex-1 text-sm text-ink-500 dark:text-ink-400">{description}</p>

      {stats.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-ink-200/70 pt-3 dark:border-white/10">
          {stats.map((st) => (
            <div key={st.label}>
              <div className="text-[11px] uppercase tracking-wide text-ink-500 dark:text-ink-400">
                {st.label}
              </div>
              <div className="text-sm font-semibold tabular-nums">{st.value}</div>
            </div>
          ))}
        </div>
      )}
    </Link>
  );
}
