import type { CellStatus } from './types';

const MONTHS_NOM = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

const MONTHS_SHORT = [
  'янв', 'фев', 'мар', 'апр', 'май', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
];

/** '2026-09-01' → 'Сентябрь 2026' */
export function monthLabel(iso: string): string {
  const [y, m] = iso.split('-').map(Number);
  return `${MONTHS_NOM[(m ?? 1) - 1]} ${y}`;
}

export function monthShort(iso: string): string {
  const [y, m] = iso.split('-').map(Number);
  return `${MONTHS_SHORT[(m ?? 1) - 1]} ${String(y).slice(2)}`;
}

export function currentMonthIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export function addMonths(iso: string, delta: number): string {
  const [y, m] = iso.split('-').map(Number);
  const d = new Date(Date.UTC(y, (m ?? 1) - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

/** Список месяцев вокруг текущего: от -3 до +12 */
export function monthOptions(from = -3, to = 12): string[] {
  const base = currentMonthIso();
  const out: string[] = [];
  for (let i = from; i <= to; i++) out.push(addMonths(base, i));
  return out;
}

export const nf = new Intl.NumberFormat('ru-RU');

export function num(n: number | null | undefined): string {
  return nf.format(n ?? 0);
}

export function pct(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

/**
 * Цветовая индикация по доле свободных шкафчиков.
 * зелёный — много свободно, жёлтый — средняя загрузка,
 * красный — почти полная загрузка, серый — закрыто.
 */
export type Tone = 'green' | 'amber' | 'red' | 'grey' | 'violet';

export function toneFor(status: CellStatus, free: number, total: number): Tone {
  if (status === 'closed' || total === 0) return 'grey';
  if (status === 'reserved') return 'violet';
  const share = free / total;
  if (share > 0.6) return 'green';
  if (share >= 0.25) return 'amber';
  return 'red';
}

export const TONE_CLASS: Record<Tone, string> = {
  green: 'bg-emerald-50 text-emerald-900 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/25',
  amber: 'bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/25',
  red: 'bg-rose-50 text-rose-900 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-200 dark:ring-rose-500/25',
  grey: 'bg-ink-100 text-ink-500 ring-ink-200 dark:bg-white/5 dark:text-ink-400 dark:ring-white/10',
  violet: 'bg-violet-50 text-violet-900 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-200 dark:ring-violet-500/25',
};

export const TONE_DOT: Record<Tone, string> = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-rose-500',
  grey: 'bg-ink-300 dark:bg-ink-600',
  violet: 'bg-violet-500',
};

export const TONE_LABEL: Record<Tone, string> = {
  green: 'Много свободных',
  amber: 'Средняя загрузка',
  red: 'Почти полная загрузка',
  grey: 'Закрыто',
  violet: 'Бронь',
};

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
