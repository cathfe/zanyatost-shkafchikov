'use client';

import { STATUS_CLASS } from '@/lib/format';
import { SLOT_STATUS_LABEL, type Cell, type SlotStatus } from '@/lib/types';

export const FREE_CELL: Cell = {
  status: 'free',
  campaign_id: null,
  campaign_label: null,
  reason: null,
  source: 'manual',
};

export const cellOrFree = (cell?: Cell): Cell => cell ?? FREE_CELL;

function title(cell: Cell): string {
  return [
    SLOT_STATUS_LABEL[cell.status],
    cell.campaign_label ? `РК: ${cell.campaign_label}` : null,
    cell.reason,
    cell.source === 'ap' ? 'из адресной программы' : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * Ячейка слота. Считаем слотами, не штуками, поэтому в ячейке только статус
 * и название РК. Закрытый слот заливается целиком — его должно быть видно сразу.
 */
export function StatusCell({
  cell: raw,
  size = 'md',
  onClick,
}: {
  cell?: Cell;
  size?: 'md' | 'lg';
  onClick?: () => void;
}) {
  const cell = cellOrFree(raw);

  const className = `w-full rounded-lg px-2 ${size === 'lg' ? 'py-3' : 'py-2'} text-center ring-1 ring-inset ${
    STATUS_CLASS[cell.status]
  } ${onClick ? 'transition-transform hover:scale-[1.03]' : ''}`;

  const content = (
    <>
      <span
        className={`block font-semibold ${
          cell.status === 'closed' ? 'uppercase tracking-wide' : ''
        } ${size === 'lg' ? 'text-sm' : 'text-xs'}`}
      >
        {cell.status === 'closed' ? '● Закрыт' : SLOT_STATUS_LABEL[cell.status]}
      </span>
      {(cell.campaign_label || cell.reason) && (
        <span className="mt-0.5 block truncate text-[10px] opacity-80">
          {cell.campaign_label ?? cell.reason}
        </span>
      )}
    </>
  );

  if (onClick) {
    return (
      <button onClick={onClick} className={className} title={title(cell)}>
        {content}
      </button>
    );
  }
  return (
    <div className={className} title={title(cell)}>
      {content}
    </div>
  );
}

export function StatusDot({ status }: { status: SlotStatus }) {
  const map: Record<SlotStatus, string> = {
    free: 'bg-emerald-500',
    booked: 'bg-violet-500',
    occupied: 'bg-brand-500',
    closed: 'bg-rose-600',
  };
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${map[status]}`} />;
}

export function SlotLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-500 dark:text-ink-400">
      {(['free', 'booked', 'occupied', 'closed'] as SlotStatus[]).map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <StatusDot status={s} />
          {SLOT_STATUS_LABEL[s]}
        </span>
      ))}
    </div>
  );
}
