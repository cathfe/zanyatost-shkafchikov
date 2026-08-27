'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import {
  GENDER_LABEL,
  SLOTS,
  SLOT_STATUSES,
  SLOT_STATUS_LABEL,
  cellKey,
  type CampaignRef,
  type ClubSlots,
  type Gender,
  type Manager,
  type SlotStatus,
  type SurfaceType,
} from '@/lib/types';
import { monthLabel, monthOptions, num } from '@/lib/format';
import { StatusCell, SlotLegend, cellOrFree } from './StatusCell';
import { SlotEditor, type SlotTarget } from './SlotEditor';
import { IconAlert, IconCheck, IconChevronLeft, IconChevronRight, IconSearch } from './Icons';
import { StatCard } from './StatCard';

/**
 * Общий экран для шкафчиков и зеркал.
 *
 * Разница одна: у шкафчиков два слота на раздевалку, у зеркал слотов нет —
 * учёт идёт сразу по раздевалке.
 */
export function SurfaceBoard({
  clubs,
  month,
  surface,
  managers,
  campaigns,
  canEdit,
}: {
  clubs: ClubSlots[];
  month: string;
  surface: SurfaceType;
  managers: Manager[];
  campaigns: CampaignRef[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const withSlots = surface === 'lockers';
  const basePath = withSlots ? '/lockers' : '/mirrors';

  const [query, setQuery] = useState('');
  const [manager, setManager] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | SlotStatus>('all');
  const [onlyActive, setOnlyActive] = useState(true);
  const [target, setTarget] = useState<SlotTarget | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clubs.filter((c) => {
      if (q && !`${c.club_name} ${c.network ?? ''}`.toLowerCase().includes(q)) return false;
      if (manager !== 'all' && c.manager_id !== manager) return false;
      // «Свободно» в базе не хранится: свободный слот — это отсутствие строки.
      // Поэтому свободный клуб определяем по отсутствию несвободных ячеек.
      if (statusFilter === 'free') {
        if (busyCount(c) === expectedCells(withSlots)) return false;
      } else if (statusFilter !== 'all' && c.counts[statusFilter] === 0) {
        return false;
      }
      if (onlyActive && busyCount(c) === 0) return false;
      return true;
    });
  }, [clubs, query, manager, statusFilter, onlyActive, withSlots]);

  const totals = useMemo(() => {
    const acc: Record<SlotStatus, number> = { free: 0, booked: 0, occupied: 0, closed: 0 };
    for (const c of filtered) {
      for (const s of SLOT_STATUSES) acc[s] += c.counts[s];
      // свободные строки не хранятся — добираем их как остаток
      acc.free += Math.max(expectedCells(withSlots) - busyCount(c), 0);
    }
    return acc;
  }, [filtered, withSlots]);

  const go = (next: Record<string, string>) => {
    const sp = new URLSearchParams(params.toString());
    Object.entries(next).forEach(([k, v]) => sp.set(k, v));
    startTransition(() => router.push(`${basePath}?${sp.toString()}`, { scroll: false }));
  };

  const notify = (ok: boolean, text: string) => {
    setToast({ ok, text });
    setTimeout(() => setToast(null), 3500);
  };

  const months = monthOptions(-6, 12);
  const monthIndex = months.indexOf(month);
  const managerName = managers.find((m) => m.id === manager)?.name;

  const open = (club: ClubSlots, slot: 1 | 2 | null, gender: Gender) => {
    if (!canEdit) return;
    const key = slot === null ? gender : cellKey(slot, gender);
    setTarget({
      clubId: club.club_id,
      clubName: club.club_name,
      slot,
      gender,
      cell: cellOrFree(club.cells[key]),
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {withSlots ? 'Занятость шкафчиков' : 'Зеркала в раздевалках'}
          </h1>
          <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">
            {monthLabel(month)} ·{' '}
            {withSlots ? 'учёт по слотам, без количества шкафчиков' : 'учёт по раздевалкам, слотов нет'}
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
            <Link
              href={`/lockers?month=${month}`}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium ${
                withSlots ? 'bg-ink-900 text-white dark:bg-white dark:text-ink-900' : 'text-ink-500'
              }`}
            >
              Шкафчики
            </Link>
            <Link
              href={`/mirrors?month=${month}`}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium ${
                !withSlots ? 'bg-ink-900 text-white dark:bg-white dark:text-ink-900' : 'text-ink-500'
              }`}
            >
              Зеркала
            </Link>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Chip active={manager === 'all'} onClick={() => setManager('all')} label="Все клубы" />
        {managers.map((m) => (
          <Chip
            key={m.id}
            active={manager === m.id}
            onClick={() => setManager(m.id)}
            label={`Клубы: ${m.name}`}
          />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="Клубов" value={num(filtered.length)} hint="в выборке" />
        <StatCard label="Свободно" value={num(totals.free)} accent="green" hint={withSlots ? 'слотов' : 'раздевалок'} />
        <StatCard label="Бронь" value={num(totals.booked)} accent="brand" hint="ждут запуска РК" />
        <StatCard label="Занято" value={num(totals.occupied)} accent="amber" hint="РК размещена" />
        <StatCard label="Закрыто" value={num(totals.closed)} accent={totals.closed ? 'red' : 'grey'} />
      </div>

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

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | SlotStatus)}
            className="input"
          >
            <option value="all">Любой статус</option>
            {SLOT_STATUSES.map((s) => (
              <option key={s} value={s}>
                Есть «{SLOT_STATUS_LABEL[s].toLowerCase()}»
              </option>
            ))}
          </select>

          <label className="inline-flex cursor-pointer items-center gap-2 self-center text-xs text-ink-500 dark:text-ink-400">
            <input
              type="checkbox"
              checked={onlyActive}
              onChange={(e) => setOnlyActive(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-ink-300 text-brand-600"
            />
            Скрывать полностью свободные клубы
          </label>
        </div>

        <div className="mt-3 border-t border-ink-200/70 pt-3 dark:border-white/10">
          <SlotLegend />
        </div>
      </div>

      {pending && <div className="text-xs text-ink-500">Обновляем…</div>}

      {filtered.length === 0 ? (
        <div className="card grid place-items-center px-6 py-16 text-center">
          <div className="max-w-sm">
            <div className="text-sm font-medium">Ничего не найдено</div>
            <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
              {onlyActive
                ? 'Все клубы в выборке свободны. Снимите галочку «скрывать полностью свободные», чтобы увидеть их.'
                : 'Попробуйте изменить условия поиска или выбрать другой месяц.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead className="border-b border-ink-200/70 bg-ink-50/60 dark:border-white/10 dark:bg-white/5">
                {withSlots ? (
                  <>
                    <tr>
                      <th className="th sticky left-0 z-10 bg-ink-50/95 dark:bg-ink-900/95">Клуб</th>
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
                  </>
                ) : (
                  <tr>
                    <th className="th sticky left-0 z-10 bg-ink-50/95 dark:bg-ink-900/95">Клуб</th>
                    {(['male', 'female'] as Gender[]).map((g) => (
                      <th key={g} className="th text-center">
                        {GENDER_LABEL[g]} раздевалка
                      </th>
                    ))}
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-ink-200/60 dark:divide-white/5">
                {filtered.map((club) => (
                  <tr key={club.club_id} className="group hover:bg-ink-50/70 dark:hover:bg-white/5">
                    <td className="td sticky left-0 z-10 bg-white group-hover:bg-ink-50/70 dark:bg-ink-900 dark:group-hover:bg-ink-800">
                      <Link
                        href={`/lockers/${club.club_id}?month=${month}`}
                        className="font-medium hover:text-brand-600 dark:hover:text-brand-300"
                      >
                        {club.club_name}
                      </Link>
                      <div className="text-[11px] text-ink-400">
                        {[club.network ?? 'без сети', club.manager_name].filter(Boolean).join(' · ')}
                      </div>
                    </td>

                    {withSlots
                      ? SLOTS.map((slot) =>
                          (['male', 'female'] as Gender[]).map((g) => (
                            <td key={`${slot}${g}`} className="td w-[130px]">
                              <StatusCell
                                cell={club.cells[cellKey(slot, g)]}
                                onClick={canEdit ? () => open(club, slot, g) : undefined}
                              />
                            </td>
                          )),
                        )
                      : (['male', 'female'] as Gender[]).map((g) => (
                          <td key={g} className="td w-[200px]">
                            <StatusCell
                              cell={club.cells[g]}
                              onClick={canEdit ? () => open(club, null, g) : undefined}
                            />
                          </td>
                        ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {target && (
        <SlotEditor
          target={target}
          month={month}
          surface={surface}
          campaigns={campaigns}
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

/** Сколько ячеек у клуба вообще не заведено (значит, свободны). */
/** Сколько ячеек у клуба: шкафчики — 2 слота × 2 раздевалки, зеркала — 2 раздевалки. */
function expectedCells(withSlots: boolean): number {
  return withSlots ? 4 : 2;
}

/** Ячейки с несвободным статусом. Свободные в базе не хранятся. */
function busyCount(club: ClubSlots): number {
  return club.counts.booked + club.counts.occupied + club.counts.closed;
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
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
