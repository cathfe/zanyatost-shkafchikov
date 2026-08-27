'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import {
  DISMOUNT_URGENT_DAYS,
  FORMAT_LABEL,
  FORMAT_ORDER,
  SLOT_STATUS_LABEL,
  daysLeft,
  formatSide,
  type ClubOverlapRow,
  type DismountRow,
  type FormatKey,
  type Manager,
  type SlotStatus,
} from '@/lib/types';
import { STATUS_CLASS, monthLabel, monthOptions, num } from '@/lib/format';
import { setDismount } from '@/app/admin/actions';
import { IconAlert, IconCheck, IconSearch } from './Icons';
import { StatCard } from './StatCard';
import { StatusDot } from './StatusCell';

type Filter = 'overlaps' | 'all';

const dueLabel = (due: string) => {
  const [y, m, d] = due.split('-');
  return `${d}.${m}.${y}`;
};

/** Человеческая подпись «сколько осталось». */
function leftLabel(due: string): string {
  const n = daysLeft(due);
  if (n < 0) return `срок прошёл ${-n} дн. назад`;
  if (n === 0) return 'сегодня последний день';
  if (n === 1) return 'остался 1 день';
  return `осталось ${n} дн.`;
}

/**
 * Пересечения между РК.
 *
 * Смысл раздела: увидеть клубы, где одновременно идут разные кампании
 * по разным форматам — стикеры в шкафах, зеркала, экраны. Что происходит
 * внутри раздевалки по слотам, видно в разделе «Шкафчики».
 */
export function OverlapsView({
  rows,
  dismount,
  month,
  managers,
  canEdit,
}: {
  rows: ClubOverlapRow[];
  dismount: DismountRow[];
  month: string;
  managers: Manager[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState('');
  const [manager, setManager] = useState('all');
  const [format, setFormat] = useState<'all' | FormatKey>('all');
  const [filter, setFilter] = useState<Filter>('overlaps');
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const hintKey = (d: DismountRow) => `${d.club_id}:${d.campaign_id}:${d.surface_type}`;

  /** Нерешённые подсказки и запланированные демонтажи. */
  const hints = useMemo(() => dismount.filter((d) => d.state === 'new'), [dismount]);
  const planned = useMemo(() => dismount.filter((d) => d.state === 'planned'), [dismount]);

  /** Запланированные демонтажи по клубу — их показываем прямо в таблице. */
  const plannedByClub = useMemo(() => {
    const map = new Map<string, DismountRow[]>();
    for (const d of planned) {
      const list = map.get(d.club_id) ?? [];
      list.push(d);
      map.set(d.club_id, list);
    }
    return map;
  }, [planned]);

  const decide = async (d: DismountRow, state: 'planned' | 'dismissed' | 'new') => {
    setBusy(hintKey(d));
    const res = await setDismount({
      clubId: d.club_id,
      clubName: d.club_name,
      campaignId: d.campaign_id,
      campaignLabel: d.campaign_label,
      surface: d.surface_type,
      month,
      due: d.due,
      state,
    });
    setBusy(null);
    setToast({
      ok: res.ok,
      text: res.ok
        ? state === 'planned'
          ? 'Демонтаж добавлен в пересечения'
          : state === 'dismissed'
            ? 'Подсказка закрыта'
            : 'Подсказка возвращена'
        : res.error,
    });
    setTimeout(() => setToast(null), 3000);
    if (res.ok) router.refresh();
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => {
        // запланированный демонтаж — тоже повод показать клуб в пересечениях
        if (filter === 'overlaps' && !r.is_overlap && !plannedByClub.has(r.club_id)) return false;
        if (manager !== 'all' && r.manager_id !== manager) return false;
        if (format !== 'all' && formatSide(r, format).campaigns.length === 0) return false;
        if (q) {
          const hay = [
            r.club_name,
            r.network ?? '',
            ...r.lockers_campaigns,
            ...r.mirrors_campaigns,
            ...r.screens_campaigns,
          ]
            .join(' ')
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          Number(b.is_overlap) - Number(a.is_overlap) ||
          b.formats_busy - a.formats_busy ||
          a.club_name.localeCompare(b.club_name, 'ru'),
      );
  }, [rows, query, manager, format, filter, plannedByClub]);

  const overlaps = rows.filter((r) => r.is_overlap);
  const campaignsTotal = new Set(
    rows.flatMap((r) => [...r.lockers_campaigns, ...r.mirrors_campaigns, ...r.screens_campaigns]),
  ).size;
  const threeFormats = rows.filter((r) => r.formats_busy >= 3).length;

  const go = (m: string) => startTransition(() => router.push(`/overlaps?month=${m}`, { scroll: false }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Пересечения между РК</h1>
          <p className="mt-0.5 max-w-2xl text-sm text-ink-500 dark:text-ink-400">
            Клубы, где в одном месяце идут разные рекламные кампании по разным форматам:
            стикеры в шкафах, зеркала, экраны. {monthLabel(month)}.
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard
          label="Клубов с пересечением"
          value={num(overlaps.length)}
          accent={overlaps.length ? 'amber' : 'green'}
          hint="разные РК на разных форматах"
        />
        <StatCard label="Все три формата" value={num(threeFormats)} accent={threeFormats ? 'red' : 'grey'} />
        <StatCard label="Клубов с размещениями" value={num(rows.length)} />
        <StatCard label="Кампаний в работе" value={num(campaignsTotal)} accent="brand" />
        <StatCard
          label="Можно снять"
          value={num(hints.length)}
          accent={hints.length ? 'amber' : 'grey'}
          hint={planned.length ? `запланировано: ${planned.length}` : 'РК заканчивается в этом месяце'}
        />
      </div>

      {(hints.length > 0 || planned.length > 0) && (
        <section className="card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Можно снять</h2>
              <p className="text-xs text-ink-500 dark:text-ink-400">
                РК заканчивается в этом месяце — стикеры и зеркала освобождаются.
                Запланируйте демонтаж, и он попадёт в таблицу пересечений, или закройте подсказку.
              </p>
            </div>
            {planned.length > 0 && (
              <span className="chip bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-500/30">
                запланировано: {planned.length}
              </span>
            )}
          </div>

          {hints.length === 0 ? (
            <p className="mt-3 text-sm text-ink-500 dark:text-ink-400">
              Все подсказки разобраны.
            </p>
          ) : (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {hints.map((d) => {
                const left = daysLeft(d.due);
                const urgent = left <= DISMOUNT_URGENT_DAYS;
                return (
                  <div
                    key={hintKey(d)}
                    className={`rounded-xl border p-3 ${
                      urgent
                        ? 'border-rose-200 bg-rose-50/60 dark:border-rose-500/30 dark:bg-rose-500/10'
                        : 'border-ink-200/70 dark:border-white/10'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{d.club_name}</div>
                        <div className="text-[11px] text-ink-400">
                          {[d.network ?? 'без сети', d.manager_name].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <span
                        className={`chip shrink-0 ${
                          urgent
                            ? 'bg-rose-100 text-rose-800 ring-rose-300 dark:bg-rose-500/15 dark:text-rose-200 dark:ring-rose-500/30'
                            : 'bg-ink-100 text-ink-600 ring-ink-200 dark:bg-white/5 dark:text-ink-300 dark:ring-white/10'
                        }`}
                      >
                        {leftLabel(d.due)}
                      </span>
                    </div>

                    <p className="mt-2 text-sm">
                      Снять{' '}
                      <span className="font-medium">
                        {FORMAT_LABEL[d.surface_type as FormatKey].toLowerCase()}
                      </span>{' '}
                      после {dueLabel(d.due)} — заканчивается «{d.campaign_label}».
                    </p>

                    {canEdit && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          onClick={() => decide(d, 'planned')}
                          disabled={busy === hintKey(d)}
                          className="btn-primary px-3 py-1.5 text-xs"
                        >
                          Запланировать демонтаж
                        </button>
                        <button
                          onClick={() => decide(d, 'dismissed')}
                          disabled={busy === hintKey(d)}
                          className="btn-ghost px-3 py-1.5 text-xs"
                        >
                          Не нужно
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {planned.length > 0 && (
            <div className="mt-3 border-t border-ink-200/70 pt-3 dark:border-white/10">
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">
                Запланированный демонтаж
              </div>
              <div className="flex flex-wrap gap-2">
                {planned.map((d) => (
                  <span
                    key={hintKey(d)}
                    className="inline-flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-xs text-brand-800 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200"
                  >
                    <IconCheck className="h-3 w-3" />
                    {d.club_name} · {FORMAT_LABEL[d.surface_type as FormatKey].toLowerCase()} · после{' '}
                    {dueLabel(d.due)}
                    {canEdit && (
                      <button
                        onClick={() => decide(d, 'new')}
                        disabled={busy === hintKey(d)}
                        className="text-ink-400 hover:text-ink-700 dark:hover:text-ink-200"
                        title="Вернуть в подсказки"
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <div className="card flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-[220px] flex-1">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по клубу или кампании…"
            className="input pl-9"
          />
        </div>

        <select value={manager} onChange={(e) => setManager(e.target.value)} className="input w-auto min-w-[180px]">
          <option value="all">Все менеджеры</option>
          {managers.map((m) => (
            <option key={m.id} value={m.id}>
              Клубы: {m.name}
            </option>
          ))}
        </select>

        <select
          value={format}
          onChange={(e) => setFormat(e.target.value as 'all' | FormatKey)}
          className="input w-auto min-w-[180px]"
        >
          <option value="all">Любой формат</option>
          {FORMAT_ORDER.map((f) => (
            <option key={f} value={f}>
              Есть {FORMAT_LABEL[f].toLowerCase()}
            </option>
          ))}
        </select>

        <div className="flex rounded-lg border border-ink-200 p-0.5 dark:border-white/10">
          {[
            { v: 'overlaps' as Filter, l: 'Только пересечения' },
            { v: 'all' as Filter, l: 'Все клубы с РК' },
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

      {filtered.length === 0 ? (
        <div className="card grid place-items-center px-6 py-16 text-center">
          <div className="max-w-md">
            <div className="text-sm font-medium">
              {filter === 'overlaps' ? 'Пересечений нет' : 'Клубов с размещениями нет'}
            </div>
            <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
              В {monthLabel(month).toLowerCase()} по выбранным условиям ничего не найдено.
              Попробуйте другой месяц — данные есть не за каждый.
            </p>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse">
              <thead className="border-b border-ink-200/70 bg-ink-50/60 dark:border-white/10 dark:bg-white/5">
                <tr>
                  <th className="th sticky left-0 z-10 bg-ink-50/95 dark:bg-ink-900/95">Клуб</th>
                  {FORMAT_ORDER.map((f) => (
                    <th key={f} className="th">
                      {FORMAT_LABEL[f]}
                    </th>
                  ))}
                  <th className="th text-center">Итог</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-200/60 dark:divide-white/5">
                {filtered.map((r) => (
                  <tr
                    key={r.club_id}
                    className={`align-top ${r.is_overlap ? 'bg-amber-50/40 dark:bg-amber-500/5' : ''}`}
                  >
                    <td className="td sticky left-0 z-10 bg-white dark:bg-ink-900">
                      <Link
                        href={`/lockers/${r.club_id}?month=${month}`}
                        className="font-medium hover:text-brand-600 dark:hover:text-brand-300"
                      >
                        {r.club_name}
                      </Link>
                      <div className="text-[11px] text-ink-400">
                        {[r.network ?? 'без сети', r.manager_name].filter(Boolean).join(' · ')}
                      </div>
                    </td>

                    {FORMAT_ORDER.map((f) => (
                      <td key={f} className="td min-w-[190px]">
                        <FormatCell
                          side={formatSide(r, f)}
                          dismount={(plannedByClub.get(r.club_id) ?? []).filter(
                            (d) => d.surface_type === f,
                          )}
                        />
                      </td>
                    ))}

                    <td className="td text-center">
                      {r.is_overlap ? (
                        <span className="chip bg-amber-100 text-amber-800 ring-amber-300 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/30">
                          <IconAlert className="h-3 w-3" />
                          пересечение
                        </span>
                      ) : (
                        <span className="chip bg-ink-100 text-ink-500 ring-ink-200 dark:bg-white/5 dark:text-ink-400 dark:ring-white/10">
                          одна РК
                        </span>
                      )}
                      {plannedByClub.has(r.club_id) && (
                        <div className="mt-1">
                          <span className="chip bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-500/30">
                            демонтаж
                          </span>
                        </div>
                      )}
                      <div className="mt-1 text-[11px] text-ink-400">
                        форматов: {r.formats_busy} · кампаний: {r.campaigns_total}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function FormatCell({
  side,
  dismount = [],
}: {
  side: { campaigns: string[]; statuses: SlotStatus[] };
  dismount?: DismountRow[];
}) {
  const marks = dismount.map((d) => (
    <div
      key={d.campaign_id}
      className="rounded-lg border border-dashed border-brand-300 bg-brand-50/60 px-2 py-1.5 text-xs text-brand-800 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-200"
    >
      <span className="block font-medium">демонтаж</span>
      <span className="block text-[11px]">после {dueLabel(d.due)}</span>
    </div>
  ));

  if (side.campaigns.length === 0) {
    return marks.length ? (
      <div className="space-y-1">{marks}</div>
    ) : (
      <span className="text-xs text-ink-400">свободно</span>
    );
  }

  // если по формату есть занятые и забронированные — показываем оба состояния
  const status: SlotStatus = side.statuses.includes('occupied') ? 'occupied' : 'booked';

  return (
    <div className="space-y-1">
      {side.campaigns.map((c) => (
        <div key={c} className={`rounded-lg px-2 py-1.5 text-xs ring-1 ring-inset ${STATUS_CLASS[status]}`}>
          <span className="block truncate font-medium">{c}</span>
        </div>
      ))}
      {marks}
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-500 dark:text-ink-400">
        {[...new Set(side.statuses)].map((s) => (
          <span key={s} className="inline-flex items-center gap-1">
            <StatusDot status={s} />
            {SLOT_STATUS_LABEL[s].toLowerCase()}
          </span>
        ))}
      </div>
    </div>
  );
}
