'use client';

import { useState } from 'react';
import {
  GENDER_LABEL,
  MANUAL_STATUSES,
  STATUS_LABEL,
  type Cell,
  type CellStatus,
  type Gender,
  type Slot,
  type SurfaceType,
} from '@/lib/types';
import { monthLabel } from '@/lib/format';
import { acknowledgeConflict, bulkSetStatus, clearOverride, saveOverride } from '@/app/admin/actions';
import { IconAlert } from './Icons';

export type SlotTarget = {
  clubId: string;
  clubName: string;
  slot: Slot;
  gender: Gender;
  cell: Cell;
};

/**
 * Панель правки одной раздевалки.
 *
 * Занятость приходит из импорта АП и здесь только показывается.
 * Руками ставится бронь, закрытие и вместимость.
 */
export function SlotEditor({
  target,
  month,
  surface,
  onClose,
  onDone,
}: {
  target: SlotTarget;
  month: string;
  surface: SurfaceType;
  onClose: () => void;
  onDone: (ok: boolean, text: string) => void;
}) {
  const c = target.cell;
  const [status, setStatus] = useState<CellStatus>(
    c.status === 'occupied' ? 'available' : (c.status as CellStatus),
  );
  const [total, setTotal] = useState(c.total == null ? '' : String(c.total));
  const [reserved, setReserved] = useState(String(c.reserved || ''));
  const [reservedFor, setReservedFor] = useState(c.reserved_for ?? '');
  const [note, setNote] = useState(c.note ?? '');
  const [busy, setBusy] = useState(false);

  const totalNum = total.trim() === '' ? null : Math.max(0, Number(total) || 0);
  const reservedNum = status === 'reserved' ? Math.max(0, Number(reserved) || 0) : 0;
  const freePreview =
    totalNum == null ? null : Math.max(totalNum - c.occupied - reservedNum, 0);

  const run = async (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, okText: string) => {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    onDone(res.ok, res.ok ? okText : res.error);
  };

  const submit = () =>
    run(
      () =>
        saveOverride({
          clubId: target.clubId,
          clubName: target.clubName,
          month,
          slot: target.slot,
          gender: target.gender,
          surface,
          status,
          totalOverride: totalNum,
          occupiedOverride: null,
          reserved: reservedNum,
          reservedFor: status === 'reserved' ? reservedFor.trim() || null : null,
          note: note.trim() || null,
        }),
      'Сохранено',
    );

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink-950/40 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-pop sm:rounded-2xl dark:bg-ink-900">
        <div className="mb-4">
          <h2 className="text-base font-semibold">{target.clubName}</h2>
          <p className="text-sm text-ink-500 dark:text-ink-400">
            {monthLabel(month)} · Слот {target.slot} · {GENDER_LABEL[target.gender]} раздевалка
          </p>
        </div>

        {c.conflict && !c.conflict_ack && (
          <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-500/40 dark:bg-amber-500/10">
            <div className="flex items-start gap-2 font-medium text-amber-900 dark:text-amber-200">
              <IconAlert className="mt-0.5 h-4 w-4 shrink-0" />
              На эту раздевалку стояла бронь, и пришла занятость из АП
            </div>
            <div className="mt-2 space-y-0.5 text-xs text-amber-900/90 dark:text-amber-200/90">
              <div>Бронь: {c.reserved_for ?? 'без указания'} — {c.reserved} шт</div>
              <div>АП: {c.campaign_label ?? 'без названия'} — {c.occupied} шт</div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                disabled={busy}
                onClick={() =>
                  run(
                    () =>
                      acknowledgeConflict({
                        clubId: target.clubId,
                        clubName: target.clubName,
                        month,
                        slot: target.slot,
                        gender: target.gender,
                        surface,
                      }),
                    'Отмечено: это одна кампания',
                  )
                }
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
              >
                Это та же кампания
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  setStatus('available');
                  setReserved('');
                  setReservedFor('');
                }}
                className="rounded-lg border border-amber-400 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-500/10"
              >
                Снять бронь
              </button>
            </div>
          </div>
        )}

        {c.status === 'occupied' && c.campaign_label && (
          <div className="mb-4 rounded-lg bg-ink-50 px-3 py-2 text-sm dark:bg-white/5">
            <span className="text-ink-500 dark:text-ink-400">Занято по адресной программе: </span>
            <span className="font-medium">{c.campaign_label}</span>
            <span className="text-ink-500 dark:text-ink-400"> · {c.occupied} шт</span>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <span className="label">Статус раздевалки</span>
            <div className="grid grid-cols-3 gap-2">
              {MANUAL_STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`rounded-lg border px-2 py-2 text-sm font-medium transition-colors ${
                    status === s
                      ? s === 'closed'
                        ? 'border-rose-500 bg-rose-600 text-white'
                        : 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200'
                      : 'border-ink-200 text-ink-600 hover:bg-ink-50 dark:border-white/10 dark:text-ink-300 dark:hover:bg-white/5'
                  }`}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label" htmlFor="total">
              Всего шкафчиков
            </label>
            <input
              id="total"
              type="number"
              min={0}
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              placeholder="не указано"
              className="input"
            />
            <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
              Пустое поле — количество не заведено, раздевалка просто считается свободной.
            </p>
          </div>

          {status === 'reserved' && (
            <div className="grid grid-cols-[1fr_1.4fr] gap-3">
              <div>
                <label className="label" htmlFor="reserved">
                  Забронировано
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
              <div>
                <label className="label" htmlFor="reservedFor">
                  Под кого бронь
                </label>
                <input
                  id="reservedFor"
                  value={reservedFor}
                  onChange={(e) => setReservedFor(e.target.value)}
                  placeholder="клиент или кампания"
                  className="input"
                />
              </div>
            </div>
          )}

          {freePreview != null && status !== 'closed' && (
            <div className="rounded-lg bg-ink-50 px-3 py-2 text-sm dark:bg-white/5">
              Свободно после сохранения: <span className="font-semibold tabular-nums">{freePreview}</span>
              {c.occupied > 0 && (
                <span className="text-ink-500 dark:text-ink-400"> · занято по АП {c.occupied}</span>
              )}
            </div>
          )}

          <div>
            <label className="label" htmlFor="note">
              {status === 'closed' ? 'Причина закрытия' : 'Примечание'}
            </label>
            <input
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={status === 'closed' ? 'Например: технические работы' : 'необязательно'}
              className="input"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button onClick={submit} disabled={busy} className="btn-primary flex-1">
            {busy ? 'Сохраняем…' : 'Сохранить'}
          </button>
          {c.manual && (
            <button
              onClick={() =>
                run(
                  () =>
                    clearOverride({
                      clubId: target.clubId,
                      clubName: target.clubName,
                      month,
                      slot: target.slot,
                      gender: target.gender,
                      surface,
                    }),
                  'Правка снята',
                )
              }
              disabled={busy}
              className="btn-danger"
            >
              Снять правку
            </button>
          )}
          <button onClick={onClose} disabled={busy} className="btn-ghost">
            Отмена
          </button>
        </div>

        <div className="mt-4 border-t border-ink-200/70 pt-3 dark:border-white/10">
          <span className="label">Быстрые действия по клубу</span>
          <div className="flex flex-wrap gap-2">
            <QuickButton
              busy={busy}
              label={`Закрыть слот ${target.slot} целиком`}
              onClick={() =>
                run(
                  () =>
                    bulkSetStatus({
                      clubId: target.clubId,
                      clubName: target.clubName,
                      month,
                      surface,
                      slots: [target.slot],
                      genders: ['male', 'female'],
                      status: 'closed',
                      note: note.trim() || `Слот ${target.slot} закрыт`,
                    }),
                  `Слот ${target.slot} закрыт`,
                )
              }
            />
            <QuickButton
              busy={busy}
              label={`Закрыть ${GENDER_LABEL[target.gender].toLowerCase()} в обоих слотах`}
              onClick={() =>
                run(
                  () =>
                    bulkSetStatus({
                      clubId: target.clubId,
                      clubName: target.clubName,
                      month,
                      surface,
                      slots: [1, 2],
                      genders: [target.gender],
                      status: 'closed',
                      note: note.trim() || `${GENDER_LABEL[target.gender]} раздевалка закрыта`,
                    }),
                  'Раздевалка закрыта в обоих слотах',
                )
              }
            />
            <QuickButton
              busy={busy}
              label="Открыть всё в клубе"
              onClick={() =>
                run(
                  () =>
                    bulkSetStatus({
                      clubId: target.clubId,
                      clubName: target.clubName,
                      month,
                      surface,
                      slots: [1, 2],
                      genders: ['male', 'female'],
                      status: 'available',
                      note: null,
                    }),
                  'Клуб открыт',
                )
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickButton({
  label,
  onClick,
  busy,
}: {
  label: string;
  onClick: () => void;
  busy: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="rounded-lg border border-ink-200 px-2.5 py-1.5 text-xs text-ink-600 hover:bg-ink-50 disabled:opacity-50 dark:border-white/10 dark:text-ink-300 dark:hover:bg-white/5"
    >
      {label}
    </button>
  );
}
