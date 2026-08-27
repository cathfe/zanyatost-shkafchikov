import type { SlotStatus } from './types';

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
 * Цвет статуса слота. Единица учёта — слот, поэтому и цвет один на статус:
 * никаких долей и процентов.
 */
export const STATUS_CLASS: Record<SlotStatus, string> = {
  free: 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/25',
  booked: 'bg-violet-50 text-violet-800 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-200 dark:ring-violet-500/25',
  occupied: 'bg-brand-50 text-brand-800 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-100 dark:ring-brand-500/30',
  closed: 'bg-rose-600 text-white ring-rose-700 shadow-sm dark:bg-rose-600 dark:text-white dark:ring-rose-500',
};

export const STATUS_DOT: Record<SlotStatus, string> = {
  free: 'bg-emerald-500',
  booked: 'bg-violet-500',
  occupied: 'bg-brand-500',
  closed: 'bg-rose-600',
};

export const STATUS_HEX: Record<SlotStatus, string> = {
  free: '#10b981',
  booked: '#8b5cf6',
  occupied: '#3466f6',
  closed: '#e11d48',
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
