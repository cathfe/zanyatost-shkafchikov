'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import {
  GENDER_LABEL,
  SLOTS,
  SURFACE_LABEL,
  cellKey,
  groupByClub,
  type AvailabilityRow,
  type Cell,
  type Gender,
  type SurfaceType,
} from '@/lib/types';
import {
  TONE_CLASS,
  TONE_DOT,
  monthLabel,
  monthOptions,
  num,
  pct,
  toneFor,
} from '@/lib/format';
import { IconChevronLeft, IconChevronRight, IconGrid, IconSearch, IconTable } from './Icons';
import { Legend } from './Legend';
import { StatCard } from './StatCard';

type StatusFilter = 'all' | 'free' | 'busy' | 'closed';

export function OccupancyExplorer({
  rows,
  month,
  surface,
  basePath = '/',
}: {
  rows: AvailabilityRow[];
  month: string;
  surface: SurfaceType;
  basePath?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [query, setQuery] = useState('');
  const [network, setNetwork] = useState('all');
  const [city, setCity] = useState('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [view, setView] = useState<'table' | 'cards'>('table');
  const [onlyWithData, setOnlyWithData] = useState(true);

  const clubs = useMemo(() => groupByClub(rows), [rows]);

  const networks = useMemo(
    () => [...new Set(clubs.map((c) => c.network).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'ru')),
    [clubs],
  );
  const cities = useMemo(
    () => [...new Set(clubs.map((c) => c.city).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'ru')),
    [clubs],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clubs.filter((c) => {
      if (onlyWithData && c.total === 0) return false;
      if (q && !`${c.club_name} ${c.city ?? ''} ${c.network ?? ''}`.toLowerCase().includes(q)) return false;
      if (network !== 'all' && c.network !== network) return false;
      if (city !== 'all' && c.city !== city) return false;
      if (status === 'free' && c.free === 0) return false;
      if (status === 'busy' && c.occupied + c.reserved === 0) return false;
      if (status === 'closed' && !Object.values(c.cells).some((x) => x.status === 'closed')) return false;
      return true;
    });
  }, [clubs, query, network, city, status, onlyWithData]);

  const totals = useMemo(
    () =>
      filtered.reduce(
        (acc, c) => {
          acc.total += c.total;
          acc.free += c.free;
          acc.occupied += c.occupied;
          acc.reserved += c.reserved;
          return acc;
        },
        { total: 0, free: 0, occupied: 0, reserved: 0 },
      ),
    [filtered],
  );

  const go = (next: Record<string, string>) => {
    const sp = new URLSearchParams(params.toString());
    Object.entries(next).forEach(([k, v]) => sp.set(k, v));
    startTransition(() => router.push(`${basePath}?${sp.toString()}`, { scroll: false }));
  };

  const months = monthOptions(-6, 12);
  const monthIndex = months.indexOf(month);

  return (
    <div className="space-y-5">
      {/* Заголовок + переключатель месяца */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Занятость шкафчиков</h1>
          <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">
            {monthLabel(month)} · {SURFACE_LABEL[surface]} · {filtered.length} из {clubs.length} клубов
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border border-ink-200 bg-white dark:border-white/10 dark:bg-ink-900">
            <button
              className="px-2 py-2 text-ink-500 hover:text-ink-900 disabled:opacity-30 dark:hover:text-ink-100"
              disabled={monthIndex <= 0}
              onClick={() => go({ month: months[monthIndex - 1] })}
              aria-label="Предыдущий месяц"
            >
              <IconChevronLeft />
            </button>
            <select
              value={month}
              onChange={(e) => go({ month: e.target.value })}
              className="border-0 bg-transparent px-1 py-2 text-sm font-medium focus:outline-none dark:text-ink-100"
            >
              {months.map((m) => (
                <option key={m} value={m} className="dark:bg-ink-900">
                  {monthLabel(m)}
                </option>
              ))}
            </select>
            <button
              className="px-2 py-2 text-ink-500 hover:text-ink-900 disabled:opacity-30 dark:hover:text-ink-100"
              disabled={monthIndex >= months.length - 1}
              onClick={() => go({ month: months[monthIndex + 1] })}
              aria-label="Следующий месяц"
            >
              <IconChevronRight />
            </button>
          </div>

          <div className="flex rounded-lg border border-ink-200 bg-white p-0.5 dark:border-white/10 dark:bg-ink-900">
            {(['lockers', 'mirrors'] as SurfaceType[]).map((s) => (
              <button
                key={s}
                onClick={() => go({ surface: s })}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  surface === s
                    ? 'bg-ink-900 text-white dark:bg-white dark:text-ink-900'
                    : 'text-ink-500 hover:text-ink-900 dark:hover:text-ink-100'
                }`}
              >
                {s === 'lockers' ? 'Шкафчики' : 'Зеркала'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Показатели */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Клубов" value={num(filtered.length)} hint="в текущей выборке" />
        <StatCard label="Всего шкафчиков" value={num(totals.total)} hint="по двум слотам" />
        <StatCard label="Свободно" value={num(totals.free)} accent="green" hint={`${pct(totals.free, totals.total)}%`} />
        <StatCard label="Занято" value={num(totals.occupied)} accent="red" hint={`${pct(totals.occupied, totals.total)}%`} />
        <StatCard label="Бронь" value={num(totals.reserved)} accent="amber" hint="ручные брони" />
      </div>

      {/* Фильтры */}
      <div className="card p-3">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))_auto]">
          <div className="relative">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по клубу, городу, сети…"
              className="input pl-9"
            />
          </div>

          <select value={network} onChange={(e) => setNetwork(e.target.value)} className="input">
            <option value="all">Все сети</option>
            {networks.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>

          <select value={city} onChange={(e) => setCity(e.target.value)} className="input">
            <option value="all">Все города</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} className="input">
            <option value="all">Любой статус</option>
            <option value="free">Есть свободные</option>
            <option value="busy">Есть занятые</option>
            <option value="closed">Есть закрытые</option>
          </select>

          <div className="flex items-center gap-1 rounded-lg border border-ink-200 p-0.5 dark:border-white/10">
            <button
              onClick={() => setView('table')}
              className={`rounded-md p-2 ${view === 'table' ? 'bg-ink-100 text-ink-900 dark:bg-white/10 dark:text-ink-100' : 'text-ink-400'}`}
              title="Таблица"
            >
              <IconTable />
            </button>
            <button
              onClick={() => setView('cards')}
              className={`rounded-md p-2 ${view === 'cards' ? 'bg-ink-100 text-ink-900 dark:bg-white/10 dark:text-ink-100' : 'text-ink-400'}`}
              title="Карточки"
            >
              <IconGrid />
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-ink-200/70 pt-3 dark:border-white/10">
          <Legend />
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-ink-500 dark:text-ink-400">
            <input
              type="checkbox"
              checked={onlyWithData}
              onChange={(e) => setOnlyWithData(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-ink-300 text-brand-600 focus:ring-brand-500/30"
            />
            Скрывать клубы без заведённой вместимости
          </label>
        </div>
      </div>

      {pending && <div className="text-xs text-ink-500">Обновляем…</div>}

      {filtered.length === 0 ? (
        <EmptyState onlyWithData={onlyWithData} />
      ) : view === 'table' ? (
        <OccupancyTable clubs={filtered} month={month} surface={surface} />
      ) : (
        <OccupancyCards clubs={filtered} month={month} surface={surface} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function EmptyState({ onlyWithData }: { onlyWithData: boolean }) {
  return (
    <div className="card grid place-items-center px-6 py-16 text-center">
      <div className="max-w-sm">
        <div className="text-sm font-medium">Ничего не найдено</div>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
          {onlyWithData
            ? 'Попробуйте снять фильтры или отключить «скрывать клубы без заведённой вместимости» — по части клубов вместимость раздевалок ещё не заполнена.'
            : 'Попробуйте изменить условия поиска или выбрать другой месяц.'}
        </p>
      </div>
    </div>
  );
}

function CellBox({ cell }: { cell?: Cell }) {
  if (!cell) {
    return <div className="rounded-lg bg-ink-50 px-2 py-1.5 text-center text-xs text-ink-400 dark:bg-white/5">—</div>;
  }
  const tone = toneFor(cell.status, cell.free, cell.total);
  const title = [
    cell.status === 'closed' ? 'Закрыто' : `Свободно ${cell.free} из ${cell.total}`,
    cell.reserved ? `бронь ${cell.reserved}` : null,
    cell.campaign_label,
    cell.note,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className={`rounded-lg px-2 py-1.5 text-center ring-1 ring-inset ${TONE_CLASS[tone]}`} title={title}>
      {cell.status === 'closed' ? (
        <span className="text-xs font-medium">закрыто</span>
      ) : (
        <>
          <span className="text-sm font-semibold tabular-nums">{cell.free}</span>
          <span className="text-xs opacity-70"> / {cell.total}</span>
        </>
      )}
      {cell.manual && (
        <span className="ml-1 align-middle text-[10px] opacity-70" title="Правка администратора">
          ✎
        </span>
      )}
    </div>
  );
}

function OccupancyTable({
  clubs,
  month,
  surface,
}: {
  clubs: ReturnType<typeof groupByClub>;
  month: string;
  surface: SurfaceType;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="scroll-thin overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse">
          <thead className="border-b border-ink-200/70 bg-ink-50/60 dark:border-white/10 dark:bg-white/5">
            <tr>
              <th className="th sticky left-0 z-10 bg-ink-50/95 backdrop-blur dark:bg-ink-900/95">Клуб</th>
              <th className="th">Город</th>
              {SLOTS.map((slot) => (
                <th key={slot} className="th text-center" colSpan={2}>
                  Слот {slot}
                </th>
              ))}
              <th className="th text-right">Итого свободно</th>
            </tr>
            <tr className="border-t border-ink-200/50 dark:border-white/5">
              <th className="th sticky left-0 z-10 bg-ink-50/95 dark:bg-ink-900/95" />
              <th className="th" />
              {SLOTS.map((slot) =>
                (['male', 'female'] as Gender[]).map((g) => (
                  <th key={`${slot}${g}`} className="th py-1.5 text-center text-[11px] normal-case">
                    {GENDER_LABEL[g]}
                  </th>
                )),
              )}
              <th className="th" />
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-200/60 dark:divide-white/5">
            {clubs.map((club) => (
              <tr key={club.club_id} className="group hover:bg-ink-50/70 dark:hover:bg-white/5">
                <td className="td sticky left-0 z-10 bg-white group-hover:bg-ink-50/70 dark:bg-ink-900 dark:group-hover:bg-ink-800">
                  <Link
                    href={`/club/${club.club_id}?month=${month}&surface=${surface}`}
                    className="font-medium hover:text-brand-600 dark:hover:text-brand-300"
                  >
                    {club.club_name}
                  </Link>
                  {club.network && (
                    <div className="text-[11px] text-ink-400">{club.network}</div>
                  )}
                </td>
                <td className="td whitespace-nowrap text-ink-500 dark:text-ink-400">{club.city ?? '—'}</td>
                {SLOTS.map((slot) =>
                  (['male', 'female'] as Gender[]).map((g) => (
                    <td key={`${slot}${g}`} className="td w-[92px]">
                      <CellBox cell={club.cells[cellKey(slot, g)]} />
                    </td>
                  )),
                )}
                <td className="td text-right tabular-nums">
                  <span className="font-semibold">{num(club.free)}</span>
                  <span className="text-ink-400"> / {num(club.total)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OccupancyCards({
  clubs,
  month,
  surface,
}: {
  clubs: ReturnType<typeof groupByClub>;
  month: string;
  surface: SurfaceType;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {clubs.map((club) => {
        const loadTone = toneFor('available', club.free, club.total || 1);
        return (
          <Link
            key={club.club_id}
            href={`/club/${club.club_id}?month=${month}&surface=${surface}`}
            className="card block p-4 transition-shadow hover:shadow-pop"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-medium leading-tight">{club.club_name}</div>
                <div className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">
                  {[club.city, club.network].filter(Boolean).join(' · ') || '—'}
                </div>
              </div>
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${TONE_DOT[loadTone]}`} />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {SLOTS.map((slot) => (
                <div key={slot} className="rounded-lg border border-ink-200/70 p-2 dark:border-white/10">
                  <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">
                    Слот {slot}
                  </div>
                  <div className="space-y-1.5">
                    {(['male', 'female'] as Gender[]).map((g) => (
                      <div key={g} className="flex items-center gap-2">
                        <span className="w-14 shrink-0 text-[11px] text-ink-500 dark:text-ink-400">
                          {GENDER_LABEL[g]}
                        </span>
                        <div className="flex-1">
                          <CellBox cell={club.cells[cellKey(slot, g)]} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-ink-200/70 pt-2.5 text-xs dark:border-white/10">
              <span className="text-ink-500 dark:text-ink-400">Свободно всего</span>
              <span className="tabular-nums font-semibold">
                {num(club.free)} <span className="font-normal text-ink-400">/ {num(club.total)}</span>
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
