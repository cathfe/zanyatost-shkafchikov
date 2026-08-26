'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { GENDER_LABEL, SURFACE_LABEL, type Manager, type OverlapRow, type SurfaceType } from '@/lib/types';
import { monthLabel, monthOptions, num } from '@/lib/format';
import { IconAlert, IconSearch } from './Icons';
import { StatCard } from './StatCard';

type SlotPick = {
  row: OverlapRow;
  slot: 1 | 2;
};

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
  const [onlyOverlaps, setOnlyOverlaps] = useState(true);
  const [picked, setPicked] = useState<SlotPick | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (onlyOverlaps && !r.is_overlap) return false;
        if (manager !== 'all' && r.manager_id !== manager) return false;
        if (q && !`${r.club_name} ${r.network ?? ''} ${r.slot1_campaign ?? ''} ${r.slot2_campaign ?? ''}`.toLowerCase().includes(q))
          return false;
        return true;
      })
      .sort(
        (a, b) =>
          Number(b.is_overlap) - Number(a.is_overlap) ||
          a.club_name.localeCompare(b.club_name, 'ru') ||
          a.gender.localeCompare(b.gender),
      );
  }, [rows, query, manager, onlyOverlaps]);

  const overlapCount = rows.filter((r) => r.is_overlap).length;
  const clubsWithOverlap = new Set(rows.filter((r) => r.is_overlap).map((r) => r.club_id)).size;
  const projects = new Set(
    rows.flatMap((r) => [r.slot1_campaign, r.slot2_campaign].filter(Boolean) as string[]),
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
            {monthLabel(month) && ` ${monthLabel(month)}`} · {SURFACE_LABEL[surface]}
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
        <StatCard label="Занятых раздевалок" value={num(rows.length)} hint="хотя бы один слот" />
        <StatCard label="Проектов в работе" value={num(projects)} accent="brand" />
      </div>

      <div className="card flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-[240px] flex-1">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по клубу, сети или проекту…"
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
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink-600 dark:text-ink-300">
          <input
            type="checkbox"
            checked={onlyOverlaps}
            onChange={(e) => setOnlyOverlaps(e.target.checked)}
            className="h-4 w-4 rounded border-ink-300 text-brand-600"
          />
          Только пересечения
        </label>
      </div>

      {pending && <div className="text-xs text-ink-500">Обновляем…</div>}

      {filtered.length === 0 ? (
        <div className="card grid place-items-center px-6 py-16 text-center">
          <div className="max-w-sm">
            <div className="text-sm font-medium">
              {onlyOverlaps ? 'Пересечений нет' : 'Занятых раздевалок нет'}
            </div>
            <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
              {onlyOverlaps
                ? 'В этом месяце ни в одной раздевалке два слота не заняты разными проектами.'
                : 'Похоже, занятость за этот месяц ещё не загружена.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse">
              <thead className="border-b border-ink-200/70 bg-ink-50/60 dark:border-white/10 dark:bg-white/5">
                <tr>
                  <th className="th">Клуб</th>
                  <th className="th">Раздевалка</th>
                  <th className="th">Слот 1</th>
                  <th className="th">Слот 2</th>
                  <th className="th text-center">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-200/60 dark:divide-white/5">
                {filtered.map((r) => (
                  <tr
                    key={`${r.club_id}-${r.gender}`}
                    className={r.is_overlap ? 'bg-amber-50/50 dark:bg-amber-500/5' : ''}
                  >
                    <td className="td">
                      <Link
                        href={`/lockers/${r.club_id}?month=${month}&surface=${surface}`}
                        className="font-medium hover:text-brand-600 dark:hover:text-brand-300"
                      >
                        {r.club_name}
                      </Link>
                      <div className="text-[11px] text-ink-400">
                        {[r.network, r.manager_name].filter(Boolean).join(' · ')}
                      </div>
                    </td>
                    <td className="td whitespace-nowrap text-ink-500 dark:text-ink-400">
                      {GENDER_LABEL[r.gender]}
                    </td>
                    <td className="td">
                      <SlotButton row={r} slot={1} onPick={setPicked} />
                    </td>
                    <td className="td">
                      <SlotButton row={r} slot={2} onPick={setPicked} />
                    </td>
                    <td className="td text-center">
                      {r.is_overlap ? (
                        <span className="chip bg-amber-100 text-amber-800 ring-amber-300 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/30">
                          <IconAlert className="h-3 w-3" />
                          пересечение
                        </span>
                      ) : (
                        <span className="chip bg-ink-100 text-ink-500 ring-ink-200 dark:bg-white/5 dark:text-ink-400 dark:ring-white/10">
                          один проект
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {picked && <SlotDetails pick={picked} month={month} surface={surface} onClose={() => setPicked(null)} />}
    </div>
  );
}

function SlotButton({
  row,
  slot,
  onPick,
}: {
  row: OverlapRow;
  slot: 1 | 2;
  onPick: (p: SlotPick) => void;
}) {
  const campaign = slot === 1 ? row.slot1_campaign : row.slot2_campaign;
  const occupied = slot === 1 ? row.slot1_occupied : row.slot2_occupied;
  const status = slot === 1 ? row.slot1_status : row.slot2_status;

  if (status === 'closed') {
    return (
      <span className="inline-flex rounded-lg bg-rose-600 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white">
        ● Закрыт
      </span>
    );
  }

  if (!occupied) {
    return <span className="text-xs text-ink-400">свободен</span>;
  }

  return (
    <button
      onClick={() => onPick({ row, slot })}
      className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-left transition-colors hover:border-brand-400 hover:bg-brand-50/50 dark:border-white/10 dark:bg-ink-900 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/5"
    >
      <span className="block truncate text-sm font-medium">{campaign ?? 'проект не указан'}</span>
      <span className="block text-[11px] text-ink-500 dark:text-ink-400">{occupied} шкафчиков</span>
    </button>
  );
}

function SlotDetails({
  pick,
  month,
  surface,
  onClose,
}: {
  pick: SlotPick;
  month: string;
  surface: SurfaceType;
  onClose: () => void;
}) {
  const { row, slot } = pick;
  const campaign = slot === 1 ? row.slot1_campaign : row.slot2_campaign;
  const occupied = slot === 1 ? row.slot1_occupied : row.slot2_occupied;
  const other = slot === 1 ? row.slot2_campaign : row.slot1_campaign;
  const otherOccupied = slot === 1 ? row.slot2_occupied : row.slot1_occupied;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink-950/40 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-pop sm:rounded-2xl dark:bg-ink-900">
        <div className="mb-4">
          <h2 className="text-base font-semibold">{row.club_name}</h2>
          <p className="text-sm text-ink-500 dark:text-ink-400">
            {GENDER_LABEL[row.gender]} раздевалка · Слот {slot} · {monthLabel(month)}
          </p>
        </div>

        <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-4 dark:border-brand-500/30 dark:bg-brand-500/10">
          <div className="text-xs uppercase tracking-wide text-brand-700 dark:text-brand-300">
            Раздевалку занимает проект
          </div>
          <div className="mt-1 text-lg font-semibold">{campaign ?? 'проект не указан'}</div>
          <div className="mt-2 text-sm text-ink-600 dark:text-ink-300">
            {occupied} из {row.total} шкафчиков
          </div>
        </div>

        {otherOccupied > 0 && (
          <div className="mt-3 rounded-xl border border-ink-200 p-4 dark:border-white/10">
            <div className="text-xs uppercase tracking-wide text-ink-500 dark:text-ink-400">
              Второй слот этой же раздевалки
            </div>
            <div className="mt-1 text-sm font-medium">{other ?? 'проект не указан'}</div>
            <div className="mt-1 text-sm text-ink-500 dark:text-ink-400">{otherOccupied} шкафчиков</div>
            {row.is_overlap && (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                Два разных проекта в одной раздевалке одновременно — это и есть пересечение.
              </p>
            )}
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <Link href={`/lockers/${row.club_id}?month=${month}&surface=${surface}`} className="btn-primary flex-1">
            Открыть клуб
          </Link>
          <button onClick={onClose} className="btn-ghost">
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
