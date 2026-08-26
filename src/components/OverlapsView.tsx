'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import {
  GENDER_LABEL,
  STATUS_LABEL,
  SURFACE_LABEL,
  slotSide,
  type Manager,
  type OverlapRow,
  type SlotSide,
  type SurfaceType,
} from '@/lib/types';
import { monthLabel, monthOptions, num } from '@/lib/format';
import { IconAlert, IconSearch } from './Icons';
import { StatCard } from './StatCard';

type Filter = 'overlaps' | 'conflicts' | 'all';

export function OverlapsView({
  rows,
  month,
  surface,
  managers,
}: {
  rows: OverlapRow[];
  month: string;
  surface: SurfaceType;
  managers: Manager[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState('');
  const [manager, setManager] = useState('all');
  const [filter, setFilter] = useState<Filter>('overlaps');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (filter === 'overlaps' && !r.is_overlap) return false;
        if (filter === 'conflicts' && !r.has_conflict) return false;
        if (manager !== 'all' && r.manager_id !== manager) return false;
        if (
          q &&
          !`${r.club_name} ${r.network ?? ''} ${r.slot1_campaign ?? ''} ${r.slot2_campaign ?? ''} ${
            r.slot1_reserved_for ?? ''
          } ${r.slot2_reserved_for ?? ''}`
            .toLowerCase()
            .includes(q)
        )
          return false;
        return true;
      })
      .sort(
        (a, b) =>
          Number(b.has_conflict) - Number(a.has_conflict) ||
          Number(b.is_overlap) - Number(a.is_overlap) ||
          a.club_name.localeCompare(b.club_name, 'ru'),
      );
  }, [rows, query, manager, filter]);

  const overlapCount = rows.filter((r) => r.is_overlap).length;
  const conflictCount = rows.filter((r) => r.has_conflict).length;
  const clubsWithOverlap = new Set(rows.filter((r) => r.is_overlap).map((r) => r.club_id)).size;
  const projects = new Set(
    rows.flatMap((r) =>
      [r.slot1_campaign, r.slot2_campaign, r.slot1_reserved_for, r.slot2_reserved_for].filter(
        Boolean,
      ) as string[],
    ),
  ).size;

  const go = (next: Record<string, string>) => {
    const sp = new URLSearchParams({ month, surface, ...next });
    startTransition(() => router.push(`/overlaps?${sp.toString()}`, { scroll: false }));
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Пересечения между РК</h1>
          <p className="mt-0.5 max-w-2xl text-sm text-ink-500 dark:text-ink-400">
            Раздевалки, где слот 1 и слот 2 заняты одновременно разными проектами.
            {` ${monthLabel(month)}`} · {SURFACE_LABEL[surface]}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select value={month} onChange={(e) => go({ month: e.target.value })} className="input w-auto">
            {monthOptions(-6, 12).map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
          <div className="flex rounded-lg border border-ink-200 bg-white p-0.5 dark:border-white/10 dark:bg-ink-900">
            {(['lockers', 'mirrors'] as SurfaceType[]).map((s) => (
              <button
                key={s}
                onClick={() => go({ surface: s })}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium ${
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Пересечений" value={num(overlapCount)} accent={overlapCount ? 'amber' : 'green'} hint="раздевалок" />
        <StatCard label="Клубов затронуто" value={num(clubsWithOverlap)} />
        <StatCard label="Требуют разбора" value={num(conflictCount)} accent={conflictCount ? 'red' : 'grey'} hint="бронь и АП вместе" />
        <StatCard label="Проектов" value={num(projects)} accent="brand" />
      </div>

      <div className="card flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-[240px] flex-1">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по клубу или проекту…"
            className="input pl-9"
          />
        </div>
        <select value={manager} onChange={(e) => setManager(e.target.value)} className="input w-auto min-w-[190px]">
          <option value="all">Все менеджеры</option>
          {managers.map((m) => (
            <option key={m.id} value={m.id}>
              Клубы: {m.name}
            </option>
          ))}
        </select>
        <div className="flex rounded-lg border border-ink-200 p-0.5 dark:border-white/10">
          {(
            [
              { v: 'overlaps' as Filter, l: 'Пересечения' },
              { v: 'conflicts' as Filter, l: 'Требуют разбора' },
              { v: 'all' as Filter, l: 'Все занятые' },
            ]
          ).map((o) => (
            <button
              key={o.v}
              onClick={() => setFilter(o.v)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                filter === o.v
                  ? 'bg-ink-900 text-white dark:bg-white dark:text-ink-900'
                  : 'text-ink-500 hover:text-ink-900 dark:hover:text-ink-100'
              }`}
            >
              {o.l}
            </button>
          ))}
        </div>
      </div>

      {pending && <div className="text-xs text-ink-500">Обновляем…</div>}

      {filtered.length === 0 ? (
        <div className="card grid place-items-center px-6 py-16 text-center">
          <div className="max-w-sm">
            <div className="text-sm font-medium">
              {filter === 'overlaps' ? 'Пересечений нет' : filter === 'conflicts' ? 'Разбирать нечего' : 'Занятых раздевалок нет'}
            </div>
            <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
              В этом месяце по выбранным условиям ничего не найдено.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <OverlapCard key={`${r.club_id}-${r.gender}`} row={r} month={month} surface={surface} />
          ))}
        </div>
      )}
    </div>
  );
}

function OverlapCard({
  row,
  month,
  surface,
}: {
  row: OverlapRow;
  month: string;
  surface: SurfaceType;
}) {
  return (
    <div
      className={`card overflow-hidden ${
        row.has_conflict
          ? 'border-amber-300 dark:border-amber-500/40'
          : row.is_overlap
            ? 'border-brand-200 dark:border-brand-500/30'
            : ''
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-200/70 px-4 py-3 dark:border-white/10">
        <div>
          <Link
            href={`/lockers/${row.club_id}?month=${month}&surface=${surface}`}
            className="font-semibold hover:text-brand-600 dark:hover:text-brand-300"
          >
            {row.club_name}
          </Link>
          <div className="text-xs text-ink-500 dark:text-ink-400">
            {[row.network ?? 'без сети', row.manager_name, `${GENDER_LABEL[row.gender]} раздевалка`]
              .filter(Boolean)
              .join(' · ')}
            {row.capacity_known && row.total != null && ` · всего ${row.total} шкафчиков`}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {row.is_overlap && (
            <span className="chip bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-500/25">
              пересечение
            </span>
          )}
          {row.has_conflict && (
            <span className="chip bg-amber-100 text-amber-800 ring-amber-300 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/30">
              <IconAlert className="h-3 w-3" />
              требует разбора
            </span>
          )}
        </div>
      </div>

      <div className="grid divide-y divide-ink-200/60 sm:grid-cols-2 sm:divide-x sm:divide-y-0 dark:divide-white/5">
        <SlotColumn side={slotSide(row, 1)} club={row.club_name} gender={GENDER_LABEL[row.gender]} />
        <SlotColumn side={slotSide(row, 2)} club={row.club_name} gender={GENDER_LABEL[row.gender]} />
      </div>
    </div>
  );
}

const STATUS_CHIP: Record<string, string> = {
  available: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25',
  occupied: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/25',
  reserved: 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-200 dark:ring-violet-500/25',
  closed: 'bg-rose-600 text-white ring-rose-700',
};

/** Полное содержание одного слота: клуб, раздевалка, статус, проект, причина. */
function SlotColumn({ side, club, gender }: { side: SlotSide; club: string; gender: string }) {
  const project = side.campaign ?? side.reservedFor;

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">
          Слот {side.slot}
        </span>
        <span className={`chip ${STATUS_CHIP[side.status] ?? ''}`}>{STATUS_LABEL[side.status]}</span>
      </div>

      <dl className="mt-2.5 space-y-1.5 text-sm">
        <Row label="Клуб" value={club} />
        <Row label="Раздевалка" value={`${gender} · слот ${side.slot}`} />
        <Row
          label={side.campaign ? 'Проект (из АП)' : side.reservedFor ? 'Бронь под' : 'Проект'}
          value={project ?? '—'}
          strong={Boolean(project)}
        />
        {side.status !== 'closed' && (
          <Row
            label="Шкафчиков"
            value={
              side.occupied || side.reserved
                ? [side.occupied ? `занято ${side.occupied}` : null, side.reserved ? `бронь ${side.reserved}` : null]
                    .filter(Boolean)
                    .join(' · ')
                : side.free != null
                  ? `свободно ${side.free}`
                  : 'свободно'
            }
          />
        )}
        <Row label="Причина / примечание" value={side.note ?? '—'} muted={!side.note} />
      </dl>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-xs text-ink-500 dark:text-ink-400">{label}</dt>
      <dd
        className={`text-right ${strong ? 'font-semibold' : ''} ${
          muted ? 'text-ink-400' : ''
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
