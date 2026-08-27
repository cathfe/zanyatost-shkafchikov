export type PlacementStatus = 'not_sent' | 'waiting' | 'approved' | 'declined';
export type PhotoStatus = 'expected' | 'received' | 'overdue';
export type VisitType = 'сам' | 'монтажник' | 'бтл';

export const PLACEMENT_STATUSES: PlacementStatus[] = ['not_sent', 'waiting', 'approved', 'declined'];
export const PHOTO_STATUSES: PhotoStatus[] = ['expected', 'received', 'overdue'];
export const VISIT_TYPES: VisitType[] = ['сам', 'монтажник', 'бтл'];

export const PLACEMENT_STATUS_LABEL: Record<PlacementStatus, string> = {
  not_sent: 'Не отправлено',
  waiting: 'Ждём ответ',
  approved: 'Одобрено',
  declined: 'Отказ',
};

/**
 * Раскрытие статуса. Статус — не просто слово, а вопрос «что именно».
 */
export const PLACEMENT_STATUS_DETAILS: Record<PlacementStatus, string[]> = {
  not_sent: ['не готов макет', 'ждём АП', 'нет бюджета', 'не назначен ответственный'],
  waiting: [
    'от клуба',
    'от менеджера',
    'подтверждение даты',
    'согласование макета',
    'подтверждение размещения',
  ],
  approved: ['согласовано полностью', 'согласовано с условиями', 'дата подтверждена'],
  declined: ['клуб отказал', 'нет свободных мест', 'макет не согласован', 'перенесено на другой период'],
};

export const PLACEMENT_STATUS_HEX: Record<PlacementStatus, string> = {
  not_sent: '#9ca3af',
  waiting: '#f59e0b',
  approved: '#16a34a',
  declined: '#e11d48',
};

export const PHOTO_LABEL: Record<PhotoStatus, string> = {
  expected: 'Ожидается',
  received: 'Получен',
  overdue: 'Просрочен',
};

export const PHOTO_HEX: Record<PhotoStatus, string> = {
  expected: '#9ca3af',
  received: '#16a34a',
  overdue: '#e11d48',
};

export const VISIT_LABEL: Record<VisitType, string> = {
  сам: 'САМ',
  монтажник: 'МОНТАЖНИК',
  бтл: 'БТЛ',
};

export type Placement = {
  id: string;
  campaign_id: string;
  club_id: string;
  club_name: string;
  network: string | null;
  format: string;
  status: PlacementStatus;
  status_detail: string | null;
  visit_type: VisitType;
  assignee: string | null;
  photo_status: PhotoStatus;
  photo_due: string | null;
  tasks_done: boolean;
  note: string | null;
};

export type Campaign = {
  id: string;
  client: string;
  label: string;
  period_start: string | null;
  period_end: string | null;
  placements: Placement[];
  counts: Record<PlacementStatus, number>;
  photo: Record<PhotoStatus, number>;
};

export function buildCampaigns(
  campaigns: {
    id: string;
    client: string;
    label: string;
    period_start: string | null;
    period_end: string | null;
  }[],
  placements: Placement[],
): Campaign[] {
  const byId = new Map<string, Campaign>();

  for (const c of campaigns) {
    byId.set(c.id, {
      ...c,
      placements: [],
      counts: { not_sent: 0, waiting: 0, approved: 0, declined: 0 },
      photo: { expected: 0, received: 0, overdue: 0 },
    });
  }

  for (const p of placements) {
    const c = byId.get(p.campaign_id);
    if (!c) continue;
    c.placements.push(p);
    c.counts[p.status] += 1;
    c.photo[p.photo_status] += 1;
  }

  return [...byId.values()]
    .filter((c) => c.placements.length > 0)
    .map((c) => ({
      ...c,
      placements: c.placements.sort((a, b) => a.club_name.localeCompare(b.club_name, 'ru')),
    }))
    .sort((a, b) => b.placements.length - a.placements.length || a.label.localeCompare(b.label, 'ru'));
}

export function formatPeriod(start: string | null, end: string | null): string {
  const f = (iso: string) => {
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y}`;
  };
  if (!start && !end) return 'период не указан';
  if (start && end) return `${f(start)}–${f(end)}`;
  return f((start ?? end)!);
}
