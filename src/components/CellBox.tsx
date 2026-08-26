'use client';

import { TONE_CLASS, cellText, toneFor } from '@/lib/format';
import type { Cell } from '@/lib/types';

const EMPTY: Cell = {
  total: null,
  capacity_known: false,
  occupied: 0,
  reserved: 0,
  free: null,
  status: 'available',
  campaign_label: null,
  reserved_for: null,
  note: null,
  manual: false,
  conflict: false,
  conflict_ack: false,
};

export function cellOrDefault(cell?: Cell): Cell {
  return cell ?? EMPTY;
}

export function cellTitle(cell: Cell): string {
  if (cell.status === 'closed') {
    return cell.note ? `Закрыто · ${cell.note}` : 'Закрыто администратором';
  }
  return [
    cell.capacity_known ? `Свободно ${cell.free ?? 0} из ${cell.total ?? 0}` : 'Свободно, количество не заведено',
    cell.occupied ? `занято ${cell.occupied}` : null,
    cell.reserved ? `бронь ${cell.reserved}` : null,
    cell.campaign_label ? `АП: ${cell.campaign_label}` : null,
    cell.reserved_for ? `бронь под: ${cell.reserved_for}` : null,
    cell.note,
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * Ячейка занятости.
 *
 * Закрытая раздевалка заливается целиком и подписывается словом ЗАКРЫТ —
 * этого состояния не должно быть видно «краем глаза», оно должно бросаться.
 */
export function CellBox({
  cell: raw,
  size = 'md',
  onClick,
}: {
  cell?: Cell;
  size?: 'md' | 'lg';
  onClick?: () => void;
}) {
  const cell = cellOrDefault(raw);
  const tone = toneFor(cell.status, cell.free, cell.total);
  const text = cellText(cell);
  const showConflict = cell.conflict && !cell.conflict_ack;

  const body =
    cell.status === 'closed' ? (
      <span className={`block font-bold uppercase tracking-wide ${size === 'lg' ? 'text-sm' : 'text-[11px]'}`}>
        ● Закрыт
      </span>
    ) : (
      <>
        <span className={`font-semibold tabular-nums ${size === 'lg' ? 'text-lg' : 'text-sm'}`}>{text.main}</span>
        {text.sub && <span className="text-xs opacity-70"> {text.sub}</span>}
        {(cell.campaign_label || cell.reserved_for) && (
          <span className="mt-0.5 block truncate text-[10px] opacity-80">
            {cell.campaign_label ?? cell.reserved_for}
          </span>
        )}
      </>
    );

  const className = `relative w-full rounded-lg px-2 ${
    size === 'lg' ? 'py-3' : 'py-1.5'
  } text-center ring-1 ring-inset ${TONE_CLASS[tone]} ${
    showConflict ? 'ring-2 ring-amber-500 dark:ring-amber-400' : ''
  } ${onClick ? 'transition-transform hover:scale-[1.03]' : ''}`;

  const content = (
    <>
      {body}
      {showConflict && (
        <span
          className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-amber-500 text-[10px] font-bold text-white"
          title="Бронь и занятость из АП на одной раздевалке"
        >
          !
        </span>
      )}
      {cell.manual && cell.status !== 'closed' && (
        <span className="absolute bottom-0.5 right-1 text-[9px] opacity-60" title="Ручная правка">
          ✎
        </span>
      )}
    </>
  );

  if (onClick) {
    return (
      <button onClick={onClick} className={className} title={cellTitle(cell)}>
        {content}
      </button>
    );
  }

  return (
    <div className={className} title={cellTitle(cell)}>
      {content}
    </div>
  );
}
