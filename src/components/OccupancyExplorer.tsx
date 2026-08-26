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
  type Gender,
  type Manager,
  type SurfaceType,
} from '@/lib/types';
import { monthLabel, monthOptions, num } from '@/lib/format';
import { CellBox, cellOrDefault } from './CellBox';
import { SlotEditor, type SlotTarget } from './SlotEditor';
import { IconAlert, IconCheck, IconChevronLeft, IconChevronRight, IconGrid, IconSearch, IconTable } from './Icons';
import { Legend } from './Legend';
import { StatCard } from './StatCard';

type StatusFilter = 'all' | 'free' | 'busy' | 'reserved' | 'closed' | 'conflict';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Любой статус' },
  { value: 'free', label: 'Есть свободные' },
  { value: 'busy', label: 'Есть занятые' },
  { value: 'reserved', label: 'Есть брони' },
  { value: 'closed', label: 'Есть закрытые' },
  { value: 'conflict', label: 'Требуют разбора' },
];

export function OccupancyExplorer({
  rows,
  month,
  surface,
  managers,
  canEdit,
}: {
  rows: AvailabilityRow[];
  month: string;
  surface: SurfaceType;
  managers: Manager[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [query, setQuery] = useState('');
  const [manager, setManager] = useState('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [view, setView] = useState<'table' | 'cards'>('table');
  const [target, setTarget] = useState<SlotTarget | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const clubs = useMemo(() => groupByClub(rows), [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clubs.filter((c) => {
      if (q && !`${c.club_name} ${c.network ?? ''}`.toLowerCase().includes(q)) return false;
      if (manager !== 'all' && c.manager_id !== manager) return false;
      if (status === 'free' && !Object.values(c.cells).some((x) => x.status === 'available')) return false;
      if (status === 'busy' && !Object.values(c.cells).some((x) => x.status === 'occupied')) return false;
      if (status === 'reserved' && !Object.values(c.cells).some((x) => x.status === 'reserved')) return false;
      if (status === 'closed' && c.closedCells === 0) return false;
      if (status === 'conflict' && c.conflictCells === 0) return false;
      return true;
    });
  }, [clubs, query, manager, status]);

  const stats = useMemo(() => {
    const acc = { clubs: filtered.length, occupied: 0, reserved: 0, closed: 0, conflict: 0, free: 0 };
    for (const c of filtered) {
      for (const cell of Object.values(c.cells)) {
        if (cell.status === 'occupied') acc.occupied += 1;
        else if (cell.status === 'reserved') acc.reserved += 1;
        else if (cell.status === 'closed') acc.closed += 1;
        else acc.free += 1;
        if (cell.conflict && !cell.conflict_ack) acc.conflict += 1;
      }
    }
    return acc;
  }, [filtered]);

  const go = (next: Record<string, string>) => {
    const sp = new URLSearchParams(params.toString());
    Object.entries(next).forEach(([k, v]) => sp.set(k, v));
    startTransition(() => router.push(`/lockers?${sp.toString()}`, { scroll: false }));
  };

  const notify = (ok: boolean, text: string) => {
    setToast({ ok, text });
    setTimeout(() => setToast(null), 3500);
  };

  const months = monthOptions(-6, 12);
  const monthIndex = months.indexOf(month);
  const managerName = managers.find((m) => m.id === manager)?.name;

  const openCell = (clubId: string, clubName: string, slot: 1 | 2, gender: Gender) => {
    if (!canEdit) return;
    const club = filtered.find((c) => c.club_id === clubId);
    setTarget({
      clubId,
      clubName,
      slot,
      gender,
      cell: cellOrDefault(club?.cells[cellKey(slot, gender)]),
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Занятость шкафчиков</h1>
          <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">
            {monthLabel(month)} · {SURFACE_LABEL[surface]}
            {managerName ? ` · клубы: ${managerName}` : ''} · {filtered.length} из {clubs.length} клубов
            {canEdit && ' · нажмите на ячейку, чтобы изменить'}
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

      <div className="flex flex-wrap gap-2">
        <ManagerChip active={manager === 'all'} onClick={() => setManager('all')} label="Все клубы" />
        {managers.map((m) => (
          <ManagerChip
            key={m.id}
            active={manager === m.id}
            onClick={() => setManager(m.id)}
            label={`Клубы: ${m.name}`}
          />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Клубов" value={num(stats.clubs)} hint="в выборке" />
        <StatCard label="Свободных раздевалок" value={num(stats.free)} accent="green" />
        <StatCard label="Занято по АП" value={num(stats.occupied)} accent="red" />
        <StatCard label="Броней" value={num(stats.reserved)} accent="brand" />
        <StatCard
          label="Требуют разбора"
          value={num(stats.conflict)}
          accent={stats.conflict ? 'amber' : 'grey'}
          hint={`закрыто: ${stats.closed}`}
        />
      </div>

      {stats.conflict > 0 && (
        <button
          onClick={() => setStatus('conflict')}
          className="flex w-full items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-left text-sm text-amber-900 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100 dark:hover:bg-amber-500/15"
        >
          <IconAlert className="h-4 w-4 shrink-0" />
          <span>
            <span className="font-semibold">{stats.conflict}</span> раздевалок, где стояла бронь и пришла
            занятость из АП. Возможно, это одна и та же кампания — или про бронь забыли.
          </span>
        </button>
      )}

      <div className="card p-3">
        <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]">
          <div className="relative">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по клубу…"
              className="input pl-9"
            />
          </div>

          <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} className="input">
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
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

        <div className="mt-3 border-t border-ink-200/70 pt-3 dark:border-white/10">
          <Legend />
        </div>
      </div>

      {pending && <div className="text-xs text-ink-500">Обновляем…</div>}

      {filtered.length === 0 ? (
        <div className="card grid place-items-center px-6 py-16 text-center">
          <div className="max-w-sm">
            <div className="text-sm font-medium">Ничего не найдено</div>
            <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
              Попробуйте снять фильтры или выбрать другой месяц.
            </p>
          </div>
        </div>
      ) : view === 'table' ? (
        <div className="card overflow-hidden">
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse">
              <thead className="border-b border-ink-200/70 bg-ink-50/60 dark:border-white/10 dark:bg-white/5">
                <tr>
                  <th className="th sticky left-0 z-10 bg-ink-50/95 backdrop-blur dark:bg-ink-900/95">Клуб</th>
                  {SLOTS.map((slot) => (
                    <th key={slot} className="th text-center" colSpan={2}>
                      Слот {slot}
                    </th>
                  ))}
                </tr>
                <tr className="border-t border-ink-200/50 dark:border-white/5">
                  <th className="th sticky left-0 z-10 bg-ink-50/95 dark:bg-ink-900/95" />
                  {SLOTS.map((slot) =>
                    (['male', 'female'] as Gender[]).map((g) => (
                      <th key={`${slot}${g}`} className="th py-1.5 text-center text-[11px] normal-case">
                        {GENDER_LABEL[g]}
                      </th>
                    )),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-200/60 dark:divide-white/5">
                {filtered.map((club) => (
                  <tr key={club.club_id} className="group hover:bg-ink-50/70 dark:hover:bg-white/5">
                    <td className="td sticky left-0 z-10 bg-white group-hover:bg-ink-50/70 dark:bg-ink-900 dark:group-hover:bg-ink-800">
                      <Link
                        href={`/lockers/${club.club_id}?month=${month}&surface=${surface}`}
                        className="font-medium hover:text-brand-600 dark:hover:text-brand-300"
                      >
                        {club.club_name}
                      </Link>
                      <div className="text-[11px] text-ink-400">
                        {[club.network ?? 'без сети', club.manager_name].filter(Boolean).join(' · ')}
                      </div>
                    </td>
                    {SLOTS.map((slot) =>
                      (['male', 'female'] as Gender[]).map((g) => (
                        <td key={`${slot}${g}`} className="td w-[120px]">
                          <CellBox
                            cell={club.cells[cellKey(slot, g)]}
                            onClick={canEdit ? () => openCell(club.club_id, club.club_name, slot, g) : undefined}
                          />
                        </td>
                      )),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((club) => (
            <div key={club.club_id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Link
                    href={`/lockers/${club.club_id}?month=${month}&surface=${surface}`}
                    className="font-medium leading-tight hover:text-brand-600 dark:hover:text-brand-300"
                  >
                    {club.club_name}
                  </Link>
                  <div className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">
                    {[club.network ?? 'без сети', club.manager_name].filter(Boolean).join(' · ')}
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                {SLOTS.map((slot) => (
                  <div key={slot} className="rounded-lg border border-ink-200/70 p-2 dark:border-white/10">
                    <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">
                      Слот {slot}
                    </div>
                    <div className="space-y-1.5">
                      {(['male', 'female'] as Gender[]).map((g) => (
                        <div key={g}>
                          <span className="mb-0.5 block text-[10px] text-ink-500 dark:text-ink-400">
                            {GENDER_LABEL[g]}
                          </span>
                          <CellBox
                            cell={club.cells[cellKey(slot, g)]}
                            onClick={canEdit ? () => openCell(club.club_id, club.club_name, slot, g) : undefined}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {target && (
        <SlotEditor
          target={target}
          month={month}
          surface={surface}
          onClose={() => setTarget(null)}
          onDone={(ok, text) => {
            notify(ok, text);
            if (ok) {
              setTarget(null);
              router.refresh();
            }
          }}
        />
      )}

      {toast && (
        <div
          className={`fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-2.5 text-sm text-white shadow-pop ${
            toast.ok ? 'bg-emerald-600' : 'bg-rose-600'
          }`}
        >
          <span className="inline-flex items-center gap-2">
            {toast.ok ? <IconCheck /> : <IconAlert />}
            {toast.text}
          </span>
        </div>
      )}
    </div>
  );
}

function ManagerChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 ring-inset transition-colors ${
        active
          ? 'bg-ink-900 text-white ring-ink-900 dark:bg-white dark:text-ink-900 dark:ring-white'
          : 'bg-white text-ink-600 ring-ink-200 hover:bg-ink-50 dark:bg-ink-900 dark:text-ink-300 dark:ring-white/10'
      }`}
    >
      {label}
    </button>
  );
}
