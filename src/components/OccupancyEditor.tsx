'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import {
  GENDER_LABEL,
  SLOTS,
  STATUS_LABEL,
  SURFACE_LABEL,
  cellKey,
  groupByClub,
  type AvailabilityRow,
  type Cell,
  type CellStatus,
  type Gender,
  type Manager,
  type Slot,
  type SurfaceType,
} from '@/lib/types';
import { TONE_CLASS, monthLabel, monthOptions, num, toneFor } from '@/lib/format';
import { bulkSetStatus, clearOverride, saveOverride } from '@/app/admin/actions';
import { IconAlert, IconCheck, IconSearch } from './Icons';
import { Legend } from './Legend';

type Target = {
  clubId: string;
  clubName: string;
  slot: Slot;
  gender: Gender;
  cell: Cell | undefined;
};

export function OccupancyEditor({
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
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState('');
  const [onlyManual, setOnlyManual] = useState(false);
  const [manager, setManager] = useState('all');
  const [target, setTarget] = useState<Target | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const clubs = useMemo(() => groupByClub(rows), [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clubs.filter((c) => {
      if (q && !`${c.club_name} ${c.network ?? ''}`.toLowerCase().includes(q)) return false;
      if (manager !== 'all' && c.manager_id !== manager) return false;
      if (onlyManual && !Object.values(c.cells).some((x) => x.manual)) return false;
      return true;
    });
  }, [clubs, query, manager, onlyManual]);

  const go = (next: Record<string, string>) => {
    const sp = new URLSearchParams({ month, surface, ...next });
    startTransition(() => router.push(`/admin/manage?${sp.toString()}`, { scroll: false }));
  };

  const notify = (ok: boolean, text: string) => {
    setToast({ ok, text });
    setTimeout(() => setToast(null), 3500);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Ручные изменения</h1>
          <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">
            {monthLabel(month)} · {SURFACE_LABEL[surface]} ·{' '}
            {canEdit ? 'нажмите на ячейку, чтобы изменить' : 'у вас доступ только на просмотр'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={month}
            onChange={(e) => go({ month: e.target.value })}
            className="input w-auto"
          >
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

      <div className="card flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-[240px] flex-1">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по клубу…"
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
            checked={onlyManual}
            onChange={(e) => setOnlyManual(e.target.checked)}
            className="h-4 w-4 rounded border-ink-300 text-brand-600"
          />
          Только с ручными правками
        </label>
        <div className="ml-auto">
          <Legend />
        </div>
      </div>

      {pending && <div className="text-xs text-ink-500">Обновляем…</div>}

      <div className="card overflow-hidden">
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse">
            <thead className="border-b border-ink-200/70 bg-ink-50/60 dark:border-white/10 dark:bg-white/5">
              <tr>
                <th className="th sticky left-0 z-10 bg-ink-50/95 dark:bg-ink-900/95">Клуб</th>
                {SLOTS.map((slot) => (
                  <th key={slot} className="th text-center" colSpan={2}>
                    Слот {slot}
                  </th>
                ))}
                <th className="th text-right">Быстрые действия</th>
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
                <th className="th" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-200/60 dark:divide-white/5">
              {filtered.map((club) => (
                <tr key={club.club_id} className="hover:bg-ink-50/60 dark:hover:bg-white/5">
                  <td className="td sticky left-0 z-10 bg-white dark:bg-ink-900">
                    <div className="font-medium">{club.club_name}</div>
                    <div className="text-[11px] text-ink-400">
                      {[club.network, club.manager_name].filter(Boolean).join(' · ') || '—'}
                    </div>
                  </td>

                  {SLOTS.map((slot) =>
                    (['male', 'female'] as Gender[]).map((g) => {
                      const cell = club.cells[cellKey(slot, g)];
                      const tone = cell ? toneFor(cell.status, cell.free, cell.total) : 'empty';
                      return (
                        <td key={`${slot}${g}`} className="td w-[104px]">
                          <button
                            disabled={!canEdit}
                            onClick={() =>
                              setTarget({
                                clubId: club.club_id,
                                clubName: club.club_name,
                                slot,
                                gender: g,
                                cell,
                              })
                            }
                            className={`w-full rounded-lg px-2 py-1.5 text-center ring-1 ring-inset transition-transform ${
                              canEdit ? 'hover:scale-[1.03]' : 'cursor-default'
                            } ${TONE_CLASS[tone]}`}
                          >
                            {!cell || cell.status === 'closed' ? (
                              <span className="text-[11px] font-bold uppercase tracking-wide">● Закрыт</span>
                            ) : (
                              <>
                                <span className="text-sm font-semibold tabular-nums">{cell.free}</span>
                                <span className="text-xs opacity-70"> / {cell.total}</span>
                              </>
                            )}
                            {cell?.manual && <span className="ml-1 text-[10px] opacity-70">✎</span>}
                          </button>
                        </td>
                      );
                    }),
                  )}

                  <td className="td text-right">
                    <div className="inline-flex gap-1">
                      {canEdit && SLOTS.map((slot) => (
                        <button
                          key={slot}
                          className="rounded-md border border-ink-200 px-2 py-1 text-[11px] text-ink-600 hover:bg-ink-50 dark:border-white/10 dark:text-ink-300 dark:hover:bg-white/5"
                          title={`Закрыть слот ${slot} целиком`}
                          onClick={() =>
                            startTransition(async () => {
                              const res = await bulkSetStatus({
                                clubId: club.club_id,
                                clubName: club.club_name,
                                month,
                                surface,
                                slots: [slot],
                                genders: ['male', 'female'],
                                status: 'closed',
                                note: `Слот ${slot} закрыт вручную`,
                              });
                              notify(res.ok, res.ok ? `Слот ${slot} закрыт` : res.error);
                              if (res.ok) router.refresh();
                            })
                          }
                        >
                          закрыть С{slot}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-ink-500 dark:text-ink-400">
            Клубы не найдены
          </p>
        )}
      </div>

      {target && (
        <EditPanel
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
          className={`fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-2.5 text-sm shadow-pop ${
            toast.ok ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
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

/* ------------------------------------------------------------------ */

function EditPanel({
  target,
  month,
  surface,
  onClose,
  onDone,
}: {
  target: Target;
  month: string;
  surface: SurfaceType;
  onClose: () => void;
  onDone: (ok: boolean, text: string) => void;
}) {
  const c = target.cell;
  const [status, setStatus] = useState<CellStatus>(c?.status ?? 'available');
  const [total, setTotal] = useState(String(c?.total ?? 0));
  const [occupied, setOccupied] = useState(String(c?.occupied ?? 0));
  const [reserved, setReserved] = useState(String(c?.reserved ?? 0));
  const [note, setNote] = useState(c?.note ?? '');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const res = await saveOverride({
      clubId: target.clubId,
      clubName: target.clubName,
      month,
      slot: target.slot,
      gender: target.gender,
      surface,
      status,
      totalOverride: Number(total) || 0,
      occupiedOverride: Number(occupied) || 0,
      reserved: Number(reserved) || 0,
      note: note.trim() || null,
    });
    setBusy(false);
    onDone(res.ok, res.ok ? 'Изменение сохранено' : res.error);
  };

  const reset = async () => {
    setBusy(true);
    const res = await clearOverride({
      clubId: target.clubId,
      clubName: target.clubName,
      month,
      slot: target.slot,
      gender: target.gender,
      surface,
    });
    setBusy(false);
    onDone(res.ok, res.ok ? 'Правка снята, вернулись данные импорта' : res.error);
  };

  const free = Math.max((Number(total) || 0) - (Number(occupied) || 0) - (Number(reserved) || 0), 0);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-pop sm:rounded-2xl dark:bg-ink-900">
        <div className="mb-4">
          <h2 className="text-base font-semibold">{target.clubName}</h2>
          <p className="text-sm text-ink-500 dark:text-ink-400">
            {monthLabel(month)} · Слот {target.slot} · {GENDER_LABEL[target.gender]} раздевалка
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <span className="label">Статус</span>
            <div className="grid grid-cols-3 gap-2">
              {(['available', 'reserved', 'closed'] as CellStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`rounded-lg border px-2 py-2 text-sm font-medium transition-colors ${
                    status === s
                      ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200'
                      : 'border-ink-200 text-ink-600 hover:bg-ink-50 dark:border-white/10 dark:text-ink-300 dark:hover:bg-white/5'
                  }`}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label" htmlFor="total">
                Всего
              </label>
              <input id="total" type="number" min={0} value={total} onChange={(e) => setTotal(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="occupied">
                Занято
              </label>
              <input
                id="occupied"
                type="number"
                min={0}
                value={occupied}
                onChange={(e) => setOccupied(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="reserved">
                Бронь
              </label>
              <input
                id="reserved"
                type="number"
                min={0}
                value={reserved}
                onChange={(e) => setReserved(e.target.value)}
                className="input"
              />
            </div>
          </div>

          <div className="rounded-lg bg-ink-50 px-3 py-2 text-sm dark:bg-white/5">
            Свободно после сохранения: <span className="font-semibold tabular-nums">{num(free)}</span>
          </div>

          <div>
            <label className="label" htmlFor="note">
              Примечание
            </label>
            <input
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Например: клуб снят заказчиком"
              className="input"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button onClick={submit} disabled={busy} className="btn-primary flex-1">
            {busy ? 'Сохраняем…' : 'Сохранить'}
          </button>
          {c?.manual && (
            <button onClick={reset} disabled={busy} className="btn-danger">
              Снять правку
            </button>
          )}
          <button onClick={onClose} disabled={busy} className="btn-ghost">
            Отмена
          </button>
        </div>

        <p className="mt-3 text-xs text-ink-500 dark:text-ink-400">
          Ручная правка имеет приоритет над импортом: последующие загрузки АП её не перезапишут.
        </p>
      </div>
    </div>
  );
}
