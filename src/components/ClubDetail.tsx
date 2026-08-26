'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  GENDER_LABEL,
  SLOTS,
  SURFACE_LABEL,
  cellKey,
  type Cell,
  type Gender,
  type Slot,
  type SurfaceType,
} from '@/lib/types';
import { TONE_CLASS, monthLabel, monthShort, num, toneFor } from '@/lib/format';
import { CellBox, cellOrDefault } from './CellBox';
import { SlotEditor, type SlotTarget } from './SlotEditor';
import { Legend } from './Legend';
import { StatCard } from './StatCard';
import { IconAlert, IconCheck } from './Icons';

export type TimelinePoint = { month: string; cells: Record<string, Cell> };

export function ClubDetail({
  club,
  month,
  surface,
  cells,
  timeline,
  canEdit,
}: {
  club: { id: string; name: string; network: string | null; managerName: string | null };
  month: string;
  surface: SurfaceType;
  cells: Record<string, Cell>;
  timeline: TimelinePoint[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [target, setTarget] = useState<SlotTarget | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const notify = (ok: boolean, text: string) => {
    setToast({ ok, text });
    setTimeout(() => setToast(null), 3500);
  };

  const list = SLOTS.flatMap((slot) =>
    (['male', 'female'] as Gender[]).map((gender) => ({
      slot,
      gender,
      cell: cellOrDefault(cells[cellKey(slot, gender)]),
    })),
  );

  const open = list.filter((x) => x.cell.status !== 'closed');
  const known = open.filter((x) => x.cell.capacity_known);
  const totalKnown = known.reduce((a, x) => a + (x.cell.total ?? 0), 0);
  const freeKnown = known.reduce((a, x) => a + (x.cell.free ?? 0), 0);
  const occupied = open.reduce((a, x) => a + x.cell.occupied, 0);
  const closedCount = list.length - open.length;
  const conflicts = list.filter((x) => x.cell.conflict && !x.cell.conflict_ack).length;

  return (
    <div className="space-y-5">
      <div>
        <Link
          href={`/lockers?month=${month}&surface=${surface}`}
          className="text-sm text-ink-500 hover:text-brand-600 dark:text-ink-400"
        >
          ← К занятости
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">{club.name}</h1>
        <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">
          {[club.network ?? 'без сети', club.managerName].filter(Boolean).join(' · ')} · {monthLabel(month)} ·{' '}
          {SURFACE_LABEL[surface]}
        </p>
      </div>

      {closedCount > 0 && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
          {closedCount === 4
            ? 'Клуб закрыт для размещения в этом месяце'
            : `Закрытых раздевалок в этом месяце: ${closedCount} из 4`}
        </div>
      )}

      {conflicts > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
          <IconAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            В {conflicts} раздевалках стояла бронь и пришла занятость из АП. Откройте раздевалку и
            решите: это одна кампания или бронь забыли снять.
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Всего шкафчиков"
          value={known.length ? num(totalKnown) : '—'}
          hint={known.length ? 'по заведённым раздевалкам' : 'количество не заведено'}
        />
        <StatCard label="Свободно" value={known.length ? num(freeKnown) : '—'} accent="green" />
        <StatCard label="Занято по АП" value={num(occupied)} accent={occupied ? 'red' : 'grey'} />
        <StatCard label="Закрыто" value={`${closedCount} / 4`} accent={closedCount ? 'red' : 'grey'} hint="раздевалок" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {list.map(({ slot, gender, cell }) => (
          <SlotCard
            key={`${slot}-${gender}`}
            slot={slot}
            gender={gender}
            cell={cell}
            canEdit={canEdit}
            onEdit={() => setTarget({ clubId: club.id, clubName: club.name, slot, gender, cell })}
          />
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-200/70 px-4 py-3 dark:border-white/10">
          <h2 className="text-sm font-semibold">Занятость по месяцам</h2>
          <Legend />
        </div>

        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead className="bg-ink-50/60 dark:bg-white/5">
              <tr>
                <th className="th sticky left-0 z-10 bg-ink-50/95 dark:bg-ink-900/95">Слот / раздевалка</th>
                {timeline.map((t) => (
                  <th
                    key={t.month}
                    className={`th text-center ${t.month === month ? 'text-brand-600 dark:text-brand-300' : ''}`}
                  >
                    {monthShort(t.month)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-200/60 dark:divide-white/5">
              {SLOTS.flatMap((slot) =>
                (['male', 'female'] as Gender[]).map((gender) => (
                  <tr key={`${slot}-${gender}`}>
                    <td className="td sticky left-0 z-10 whitespace-nowrap bg-white font-medium dark:bg-ink-900">
                      Слот {slot} · {GENDER_LABEL[gender]}
                    </td>
                    {timeline.map((t) => {
                      const c = cellOrDefault(t.cells[cellKey(slot, gender)]);
                      const tone = toneFor(c.status, c.free, c.total);
                      return (
                        <td key={t.month} className="td px-1.5 py-1.5">
                          <div
                            className={`rounded-md px-1.5 py-1 text-center text-xs font-medium ring-1 ring-inset ${TONE_CLASS[tone]} ${
                              t.month === month ? 'ring-2 ring-brand-400/60' : ''
                            }`}
                            title={[
                              monthLabel(t.month),
                              c.status === 'closed' ? 'закрыта' : null,
                              c.campaign_label ? `АП: ${c.campaign_label}` : null,
                              c.reserved_for ? `бронь: ${c.reserved_for}` : null,
                              c.note,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          >
                            {c.status === 'closed'
                              ? '×'
                              : c.status === 'occupied'
                                ? 'зан.'
                                : c.status === 'reserved'
                                  ? 'бронь'
                                  : c.capacity_known
                                    ? c.free
                                    : '✓'}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </div>

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

function SlotCard({
  slot,
  gender,
  cell,
  canEdit,
  onEdit,
}: {
  slot: Slot;
  gender: Gender;
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
        <span>
          Слот {slot} · {GENDER_LABEL[gender]}
        </span>
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

      {closed ? (
        /* У закрытой раздевалки цифры не показываем — только статус и причина */
        <div className="px-4 py-4">
          <div className="text-xs uppercase tracking-wide text-ink-500 dark:text-ink-400">Статус</div>
          <div className="mt-1 flex items-center gap-2 text-base font-bold text-rose-600 dark:text-rose-400">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-600" />
            Закрыта
          </div>

          <div className="mt-4 text-xs uppercase tracking-wide text-ink-500 dark:text-ink-400">Комментарий</div>
          <p className="mt-1 text-sm">
            {cell.note ?? <span className="text-ink-400">причина не указана</span>}
          </p>
        </div>
      ) : (
        <div className="px-4 py-4">
          <CellBox cell={cell} size="lg" />

          <dl className="mt-3 space-y-1 text-xs">
            {cell.capacity_known ? (
              <Row label="Всего шкафчиков" value={num(cell.total ?? 0)} />
            ) : (
              <Row label="Всего шкафчиков" value="не заведено" muted />
            )}
            {cell.occupied > 0 && <Row label="Занято по АП" value={num(cell.occupied)} />}
            {cell.campaign_label && <Row label="Кампания" value={cell.campaign_label} />}
            {cell.reserved > 0 && <Row label="Бронь" value={num(cell.reserved)} />}
            {cell.reserved_for && <Row label="Бронь под" value={cell.reserved_for} />}
            {cell.note && <Row label="Примечание" value={cell.note} />}
          </dl>
        </div>
      )}
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
