'use client';

import { useState } from 'react';
import {
  GENDER_LABEL,
  SLOT_STATUSES,
  SLOT_STATUS_DETAILS,
  SLOT_STATUS_HINT,
  SLOT_STATUS_LABEL,
  SURFACE_LABEL,
  type CampaignRef,
  type Cell,
  type Gender,
  type Slot,
  type SlotStatus,
  type SurfaceType,
} from '@/lib/types';
import { monthLabel } from '@/lib/format';
import { bulkSetSlots, setSlotStatus } from '@/app/admin/actions';
import { StatusDot } from './StatusCell';

export type SlotTarget = {
  clubId: string;
  clubName: string;
  /** null для зеркал */
  slot: Slot | null;
  gender: Gender;
  cell: Cell;
};

/**
 * Панель правки слота.
 *
 * Основное действие — «Занять слот»: выбрать РК и отметить, что размещение идёт.
 * Автоматическая загрузка из АП это же поле заполняет сама, но руками можно всегда.
 */
export function SlotEditor({
  target,
  month,
  surface,
  campaigns,
  onClose,
  onDone,
}: {
  target: SlotTarget;
  month: string;
  surface: SurfaceType;
  campaigns: CampaignRef[];
  onClose: () => void;
  onDone: (ok: boolean, text: string) => void;
}) {
  const c = target.cell;
  const [status, setStatus] = useState<SlotStatus>(c.status);
  const [campaignId, setCampaignId] = useState(c.campaign_id ?? '');
  const [detail, setDetail] = useState(c.reason ?? '');
  const [busy, setBusy] = useState(false);

  const details = SLOT_STATUS_DETAILS[status];
  const needsCampaign = status === 'occupied' || status === 'booked';
  const campaign = campaigns.find((x) => x.id === campaignId) ?? null;

  const run = async (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, okText: string) => {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    onDone(res.ok, res.ok ? okText : res.error);
  };

  const submit = () =>
    run(
      () =>
        setSlotStatus({
          clubId: target.clubId,
          clubName: target.clubName,
          month,
          surface,
          gender: target.gender,
          slot: target.slot,
          status,
          campaignId: needsCampaign ? campaignId || null : null,
          campaignLabel: needsCampaign ? campaign?.label ?? null : null,
          reason: detail.trim() || null,
        }),
      'Сохранено',
    );

  const where =
    target.slot === null
      ? `${GENDER_LABEL[target.gender]} раздевалка`
      : `Слот ${target.slot} · ${GENDER_LABEL[target.gender]} раздевалка`;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink-950/40 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-pop sm:rounded-2xl dark:bg-ink-900">
        <div className="mb-4">
          <h2 className="text-base font-semibold">{target.clubName}</h2>
          <p className="text-sm text-ink-500 dark:text-ink-400">
            {monthLabel(month)} · {SURFACE_LABEL[surface]} · {where}
          </p>
        </div>

        {c.source === 'ap' && c.campaign_label && (
          <div className="mb-4 rounded-lg bg-ink-50 px-3 py-2 text-sm dark:bg-white/5">
            <span className="text-ink-500 dark:text-ink-400">Заполнено из адресной программы: </span>
            <span className="font-medium">{c.campaign_label}</span>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <span className="label">Статус слота</span>
            <div className="grid grid-cols-2 gap-2">
              {SLOT_STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setStatus(s);
                    setDetail('');
                  }}
                  className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                    status === s
                      ? s === 'closed'
                        ? 'border-rose-500 bg-rose-600 text-white'
                        : 'border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-100'
                      : 'border-ink-200 hover:bg-ink-50 dark:border-white/10 dark:hover:bg-white/5'
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    {status !== s && <StatusDot status={s} />}
                    {SLOT_STATUS_LABEL[s]}
                  </span>
                  <span className={`mt-0.5 block text-[11px] ${status === s ? 'opacity-80' : 'text-ink-500 dark:text-ink-400'}`}>
                    {SLOT_STATUS_HINT[s]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {needsCampaign && (
            <div>
              <label className="label" htmlFor="campaign">
                Рекламная кампания
              </label>
              <select
                id="campaign"
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
                className="input"
              >
                <option value="">не выбрана</option>
                {campaigns.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.label} · {x.client}
                  </option>
                ))}
              </select>
            </div>
          )}

          {details.length > 0 && (
            <div>
              <span className="label">
                {status === 'closed' ? 'Причина' : status === 'booked' ? 'Что ожидаем' : 'Уточнение'}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {details.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDetail(d)}
                    className={`rounded-full px-3 py-1 text-xs ring-1 ring-inset transition-colors ${
                      detail === d
                        ? 'bg-ink-900 text-white ring-ink-900 dark:bg-white dark:text-ink-900 dark:ring-white'
                        : 'bg-white text-ink-600 ring-ink-200 hover:bg-ink-50 dark:bg-ink-900 dark:text-ink-300 dark:ring-white/10'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <input
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder="или впишите своё"
                className="input mt-2"
              />
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button onClick={submit} disabled={busy} className="btn-primary flex-1">
            {busy ? 'Сохраняем…' : 'Сохранить'}
          </button>
          <button onClick={onClose} disabled={busy} className="btn-ghost">
            Отмена
          </button>
        </div>

        <div className="mt-4 border-t border-ink-200/70 pt-3 dark:border-white/10">
          <span className="label">Быстрые действия по клубу</span>
          <div className="flex flex-wrap gap-2">
            {target.slot !== null && (
              <Quick
                busy={busy}
                label={`Занять слот ${target.slot} целиком`}
                onClick={() =>
                  run(
                    () =>
                      bulkSetSlots({
                        clubId: target.clubId,
                        clubName: target.clubName,
                        month,
                        surface,
                        slots: [target.slot as Slot],
                        genders: ['male', 'female'],
                        status: 'occupied',
                        campaignId: campaignId || null,
                        campaignLabel: campaign?.label ?? null,
                        reason: detail.trim() || null,
                      }),
                    `Слот ${target.slot} занят`,
                  )
                }
              />
            )}
            <Quick
              busy={busy}
              label={`Занять ${GENDER_LABEL[target.gender].toLowerCase()} раздевалку`}
              onClick={() =>
                run(
                  () =>
                    bulkSetSlots({
                      clubId: target.clubId,
                      clubName: target.clubName,
                      month,
                      surface,
                      slots: surface === 'mirrors' ? [null] : [1, 2],
                      genders: [target.gender],
                      status: 'occupied',
                      campaignId: campaignId || null,
                      campaignLabel: campaign?.label ?? null,
                      reason: detail.trim() || null,
                    }),
                  'Раздевалка занята',
                )
              }
            />
            <Quick
              busy={busy}
              label="Закрыть клуб на месяц"
              onClick={() =>
                run(
                  () =>
                    bulkSetSlots({
                      clubId: target.clubId,
                      clubName: target.clubName,
                      month,
                      surface,
                      slots: surface === 'mirrors' ? [null] : [1, 2],
                      genders: ['male', 'female'],
                      status: 'closed',
                      campaignId: null,
                      campaignLabel: null,
                      reason: detail.trim() || 'технические работы',
                    }),
                  'Клуб закрыт',
                )
              }
            />
            <Quick
              busy={busy}
              label="Освободить всё"
              onClick={() =>
                run(
                  () =>
                    bulkSetSlots({
                      clubId: target.clubId,
                      clubName: target.clubName,
                      month,
                      surface,
                      slots: surface === 'mirrors' ? [null] : [1, 2],
                      genders: ['male', 'female'],
                      status: 'free',
                      campaignId: null,
                      campaignLabel: null,
                      reason: null,
                    }),
                  'Освобождено',
                )
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Quick({ label, onClick, busy }: { label: string; onClick: () => void; busy: boolean }) {
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
