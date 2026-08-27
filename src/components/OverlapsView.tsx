'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import {
  GENDER_LABEL,
  SLOT_STATUS_HINT,
  SLOT_STATUS_LABEL,
  slotSide,
  type Manager,
  type OverlapRow,
  type SlotSide,
} from '@/lib/types';
import { STATUS_CLASS, monthLabel, monthOptions, num } from '@/lib/format';
import { IconAlert, IconSearch } from './Icons';
import { StatCard } from './StatCard';
import { StatusDot } from './StatusCell';

type Filter = 'overlaps' | 'all';

export function OverlapsView({
  rows,
  month,
  managers,
}: {
  rows: OverlapRow[];
  month: string;
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
        if (manager !== 'all' && r.manager_id !== manager) return false;
        if (
          q &&
          !`${r.club_name} ${r.network ?? ''} ${r.slot1_campaign ?? ''} ${r.slot2_campaign ?? ''}`
            .toLowerCase()
            .includes(q)
        )
          return false;
        return true;
      })
      .sort(
        (a, b) => Number(b.is_overlap) - Number(a.is_overlap) || a.club_name.localeCompare(b.club_name, 'ru'),
      );
  }, [rows, query, manager, filter]);

  const overlapCount = rows.filter((r) => r.is_overlap).length;
  const clubs = new Set(rows.filter((r) => r.is_overlap).map((r) => r.club_id)).size;
  const projects = new Set(
    rows.flatMap((r) => [r.slot1_campaign, r.slot2_campaign].filter(Boolean) as string[]),
  ).size;

  const go = (m: string) =>
    startTransition(() => router.push(`/overlaps?month=${m}`, { scroll: false }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Пересечения между РК</h1>
          <p className="mt-0.5 max-w-2xl text-sm text-ink-500 dark:text-ink-400">
            Раздевалки, где слот 1 и слот 2 заняты разными рекламными кампаниями. {monthLabel(month)}.
            Зеркал не касается — там слотов нет.
          </p>
        </div>

        <select value={month} onChange={(e) => go(e.target.value)} className="input w-auto">
          {monthOptions(-6, 12).map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Пересечений" value={num(overlapCount)} accent={overlapCount ? 'amber' : 'green'} hint="раздевалок" />
        <StatCard label="Клубов затронуто" value={num(clubs)} />
        <StatCard label="Занятых раздевалок" value={num(rows.length)} hint="хотя бы один слот" />
        <StatCard label="Кампаний" value={num(projects)} accent="brand" />
      </div>

      <div className="card flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-[240px] flex-1">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по клубу или кампании…"
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
          {[
            { v: 'overlaps' as Filter, l: 'Только пересечения' },
            { v: 'all' as Filter, l: 'Все занятые' },
          ].map((o) => (
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
              {filter === 'overlaps' ? 'Пересечений нет' : 'Занятых раздевалок нет'}
            </div>
            <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
              В этом месяце по выбранным условиям ничего не найдено.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div
              key={`${r.club_id}-${r.gender}`}
              className={`card overflow-hidden ${r.is_overlap ? 'border-amber-300 dark:border-amber-500/40' : ''}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-200/70 px-4 py-3 dark:border-white/10">
                <div>
                  <Link
                    href={`/lockers/${r.club_id}?month=${month}`}
                    className="font-semibold hover:text-brand-600 dark:hover:text-brand-300"
                  >
                    {r.club_name}
                  </Link>
                  <div className="text-xs text-ink-500 dark:text-ink-400">
                    {[r.network ?? 'без сети', r.manager_name, `${GENDER_LABEL[r.gender]} раздевалка`]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
                {r.is_overlap && (
                  <span className="chip bg-amber-100 text-amber-800 ring-amber-300 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/30">
                    <IconAlert className="h-3 w-3" />
                    две разные РК
                  </span>
                )}
              </div>

              <div className="grid divide-y divide-ink-200/60 sm:grid-cols-2 sm:divide-x sm:divide-y-0 dark:divide-white/5">
                <SlotColumn side={slotSide(r, 1)} club={r.club_name} gender={GENDER_LABEL[r.gender]} />
                <SlotColumn side={slotSide(r, 2)} club={r.club_name} gender={GENDER_LABEL[r.gender]} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Полное содержание слота: клуб, раздевалка, статус, РК, причина. */
function SlotColumn({ side, club, gender }: { side: SlotSide; club: string; gender: string }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">
          Слот {side.slot}
        </span>
        <span className={`chip ${STATUS_CLASS[side.status]}`}>
          <StatusDot status={side.status} />
          {SLOT_STATUS_LABEL[side.status]}
        </span>
      </div>

      <dl className="mt-2.5 space-y-1.5 text-sm">
        <Row label="Клуб" value={club} />
        <Row label="Раздевалка" value={`${gender} · слот ${side.slot}`} />
        <Row label="Что означает статус" value={SLOT_STATUS_HINT[side.status]} muted />
        <Row
          label="Рекламная кампания"
          value={side.campaign ?? '—'}
          strong={Boolean(side.campaign)}
        />
        <Row label="Причина / уточнение" value={side.reason ?? '—'} muted={!side.reason} />
        <Row
          label="Источник"
          value={side.source === 'ap' ? 'адресная программа' : 'вручную'}
          muted
        />
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
      <dd className={`text-right ${strong ? 'font-semibold' : ''} ${muted ? 'text-ink-400' : ''}`}>{value}</dd>
    </div>
  );
}
