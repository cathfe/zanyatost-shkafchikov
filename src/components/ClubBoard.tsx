'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  GENDER_LABEL,
  SLOTS,
  SLOT_STATUS_HINT,
  SLOT_STATUS_LABEL,
  cellKey,
  type CampaignRef,
  type Cell,
  type Gender,
  type Slot,
} from '@/lib/types';
import { STATUS_CLASS, monthLabel, monthOptions } from '@/lib/format';
import { StatusCell, SlotLegend, cellOrFree } from './StatusCell';
import { SlotEditor, type SlotTarget } from './SlotEditor';
import { IconAlert, IconCheck } from './Icons';

export type ClubBoardData = {
  id: string;
  name: string;
  network: string | null;
  managerName: string | null;
  hasLockers: boolean;
};

export function ClubBoard({
  club,
  month,
  lockers,
  mirrors,
  campaigns,
  canEdit,
}: {
  club: ClubBoardData;
  month: string;
  /** ключ `${slot}:${gender}` */
  lockers: Record<string, Cell>;
  /** ключ `${gender}` */
  mirrors: Record<string, Cell>;
  campaigns: CampaignRef[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [target, setTarget] = useState<(SlotTarget & { surface: 'lockers' | 'mirrors' }) | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const notify = (ok: boolean, text: string) => {
    setToast({ ok, text });
    setTimeout(() => setToast(null), 3500);
  };

  const openSlot = (slot: Slot | null, gender: Gender, surface: 'lockers' | 'mirrors') => {
    if (!canEdit) return;
    const cell = cellOrFree(surface === 'lockers' ? lockers[cellKey(slot!, gender)] : mirrors[gender]);
    setTarget({ clubId: club.id, clubName: club.name, slot, gender, cell, surface });
  };

  const lockerCells = SLOTS.flatMap((slot) =>
    (['male', 'female'] as Gender[]).map((gender) => ({
      slot,
      gender,
      cell: cellOrFree(lockers[cellKey(slot, gender)]),
    })),
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href={`/lockers?month=${month}`} className="text-sm text-ink-500 hover:text-brand-600 dark:text-ink-400">
            ← К занятости
          </Link>
          <h1 className="mt-2 text-xl font-semibold tracking-tight">{club.name}</h1>
          <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">
            {[club.network ?? 'без сети', club.managerName].filter(Boolean).join(' · ')} · {monthLabel(month)}
          </p>
        </div>

        <select
          value={month}
          onChange={(e) => router.push(`/lockers/${club.id}?month=${e.target.value}`)}
          className="input w-auto"
        >
          {monthOptions(-6, 12).map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
      </div>

      <div className="card p-3">
        <SlotLegend />
      </div>

      {club.hasLockers ? (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">
            Шкафчики · два слота на раздевалку
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {lockerCells.map(({ slot, gender, cell }) => (
              <SlotCard
                key={`${slot}-${gender}`}
                title={`Слот ${slot} · ${GENDER_LABEL[gender]}`}
                cell={cell}
                canEdit={canEdit}
                onEdit={() => openSlot(slot, gender, 'lockers')}
              />
            ))}
          </div>
        </section>
      ) : (
        <div className="card p-4 text-sm text-ink-500 dark:text-ink-400">
          В этом клубе нет шкафчиков — только экраны. Он участвует в кампаниях, но в учёте слотов
          не показывается.
        </div>
      )}

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">
          Зеркала · слотов нет, учёт по раздевалке
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {(['male', 'female'] as Gender[]).map((gender) => (
            <SlotCard
              key={gender}
              title={`${GENDER_LABEL[gender]} раздевалка`}
              cell={cellOrFree(mirrors[gender])}
              canEdit={canEdit}
              onEdit={() => openSlot(null, gender, 'mirrors')}
            />
          ))}
        </div>
      </section>

      {target && (
        <SlotEditor
          target={target}
          month={month}
          surface={target.surface}
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

function SlotCard({
  title,
  cell,
  canEdit,
  onEdit,
}: {
  title: string;
  cell: Cell;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const closed = cell.status === 'closed';

  return (
    <div className={`card overflow-hidden ${closed ? 'border-rose-300 dark:border-rose-500/40' : ''}`}>
      <div
        className={`flex items-center justify-between px-4 py-2.5 text-sm font-semibold ${
          closed ? 'bg-rose-600 text-white' : 'border-b border-ink-200/70 dark:border-white/10'
        }`}
      >
        <span>{title}</span>
        {canEdit && (
          <button
            onClick={onEdit}
            className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
              closed
                ? 'bg-white/20 text-white hover:bg-white/30'
                : 'border border-ink-200 text-ink-600 hover:bg-ink-50 dark:border-white/10 dark:text-ink-300 dark:hover:bg-white/5'
            }`}
          >
            изменить
          </button>
        )}
      </div>

      <div className="px-4 py-4">
        <div className={`rounded-lg px-3 py-2.5 text-center ring-1 ring-inset ${STATUS_CLASS[cell.status]}`}>
          <span className="block text-sm font-bold">
            {closed ? '● ЗАКРЫТ' : SLOT_STATUS_LABEL[cell.status]}
          </span>
          <span className="mt-0.5 block text-[11px] opacity-80">{SLOT_STATUS_HINT[cell.status]}</span>
        </div>

        <dl className="mt-3 space-y-1 text-xs">
          {cell.campaign_label && <Row label="Рекламная кампания" value={cell.campaign_label} />}
          {cell.reason && <Row label={closed ? 'Причина' : 'Уточнение'} value={cell.reason} />}
          <Row
            label="Источник"
            value={cell.source === 'ap' ? 'адресная программа' : 'заполнено вручную'}
            muted
          />
        </dl>
      </div>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-ink-500 dark:text-ink-400">{label}</dt>
      <dd className={`truncate text-right font-medium ${muted ? 'text-ink-400' : ''}`}>{value}</dd>
    </div>
  );
}
