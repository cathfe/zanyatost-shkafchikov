export type Gender = 'male' | 'female';
export type Slot = 1 | 2;
export type SurfaceType = 'lockers' | 'mirrors';
export type Role = 'admin' | 'editor' | 'viewer';

/**
 * Статус слота. Единица учёта — слот, количество шкафчиков не считаем.
 */
export type SlotStatus = 'free' | 'booked' | 'occupied' | 'closed';

export const GENDERS: Gender[] = ['male', 'female'];
export const SLOTS: Slot[] = [1, 2];
export const SLOT_STATUSES: SlotStatus[] = ['free', 'booked', 'occupied', 'closed'];

export const GENDER_LABEL: Record<Gender, string> = {
  male: 'Мужская',
  female: 'Женская',
};

export const SURFACE_LABEL: Record<SurfaceType, string> = {
  lockers: 'Шкафчики',
  mirrors: 'Зеркала',
};

/** Форматы размещения, между которыми ищем пересечения РК в клубе. */
export type FormatKey = 'lockers' | 'mirrors' | 'screens';

export const FORMAT_LABEL: Record<FormatKey, string> = {
  lockers: 'Стикеры в шкафах',
  mirrors: 'Зеркала',
  screens: 'Экраны',
};

export const FORMAT_ORDER: FormatKey[] = ['lockers', 'mirrors', 'screens'];

export const SLOT_STATUS_LABEL: Record<SlotStatus, string> = {
  free: 'Свободно',
  booked: 'Бронь',
  occupied: 'Занято',
  closed: 'Закрыто',
};

export const SLOT_STATUS_HINT: Record<SlotStatus, string> = {
  free: 'Нет активной РК, слот доступен',
  booked: 'Слот зарезервирован, размещение ещё не началось',
  occupied: 'РК размещена, слот используется',
  closed: 'Недоступен по техническим причинам',
};

/** Раскрытие статуса: что именно стоит за словом. */
export const SLOT_STATUS_DETAILS: Record<SlotStatus, string[]> = {
  free: [],
  booked: [
    'ожидание запуска РК',
    'ждём подтверждения клиента',
    'резерв под тендер',
    'бронь по договорённости',
  ],
  occupied: ['размещение идёт', 'монтаж выполнен', 'продление предыдущей РК'],
  closed: ['ремонт', 'технические работы', 'временное ограничение', 'клуб снят заказчиком'],
};

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Администратор',
  editor: 'Редактор',
  viewer: 'Просмотр',
};

export const ROLE_HINT: Record<Role, string> = {
  admin: 'Всё, включая пользователей и настройки',
  editor: 'Правки статусов и работа с размещениями',
  viewer: 'Только просмотр',
};

export type Manager = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
};

export type AppUser = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: Role;
  manager_id: string | null;
  is_active: boolean;
  created_at: string;
};

export type CampaignRef = {
  id: string;
  client: string;
  label: string;
  manager_id: string | null;
  period_start: string | null;
  period_end: string | null;
};

/** Строка из lockers_slots(month) */
export type SlotRow = {
  club_id: string;
  club_name: string;
  network: string | null;
  manager_id: string | null;
  manager_name: string | null;
  gender: Gender;
  slot: Slot;
  status: SlotStatus;
  campaign_id: string | null;
  campaign_label: string | null;
  reason: string | null;
  source: 'ap' | 'manual';
  updated_at: string | null;
};

/** Строка из lockers_mirrors(month) — слотов нет */
export type MirrorRow = Omit<SlotRow, 'slot'>;

/** Строка из lockers_club_overlaps(month) */
export type ClubOverlapRow = {
  club_id: string;
  club_name: string;
  network: string | null;
  manager_id: string | null;
  manager_name: string | null;
  lockers_campaigns: string[];
  lockers_statuses: SlotStatus[];
  mirrors_campaigns: string[];
  mirrors_statuses: SlotStatus[];
  screens_campaigns: string[];
  screens_statuses: SlotStatus[];
  formats_busy: number;
  campaigns_total: number;
  is_overlap: boolean;
};

/** Достаёт из строки кампании и статусы одного формата. */
export function formatSide(
  row: ClubOverlapRow,
  key: FormatKey,
): { campaigns: string[]; statuses: SlotStatus[] } {
  if (key === 'lockers') return { campaigns: row.lockers_campaigns, statuses: row.lockers_statuses };
  if (key === 'mirrors') return { campaigns: row.mirrors_campaigns, statuses: row.mirrors_statuses };
  return { campaigns: row.screens_campaigns, statuses: row.screens_statuses };
}

export type MonthSummary = {
  clubs_total: number;
  cells_total: number;
  cells_free: number;
  cells_booked: number;
  cells_occupied: number;
  cells_closed: number;
  load_percent: number;
};

export type Club = {
  id: string;
  name: string;
  network: string | null;
  city: string | null;
  address: string | null;
  is_active: boolean;
  has_lockers: boolean;
  manager_id: string | null;
  source: 'import' | 'manual';
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminLogEntry = {
  id: string;
  club_id: string | null;
  club_name: string | null;
  month: string | null;
  slot: number | null;
  gender: Gender | null;
  action: string;
  details: Record<string, unknown>;
  actor_id: string | null;
  actor_email: string | null;
  created_at: string;
};

/* ------------------------------------------------------------------ */
/* Группировка сетки по клубам                                         */
/* ------------------------------------------------------------------ */

export type Cell = {
  status: SlotStatus;
  campaign_id: string | null;
  campaign_label: string | null;
  reason: string | null;
  source: 'ap' | 'manual';
};

export type ClubSlots = {
  club_id: string;
  club_name: string;
  network: string | null;
  manager_id: string | null;
  manager_name: string | null;
  /** ключ `${slot}:${gender}` для шкафчиков, `${gender}` для зеркал */
  cells: Record<string, Cell>;
  counts: Record<SlotStatus, number>;
};

export const cellKey = (slot: Slot | number, gender: Gender) => `${slot}:${gender}`;

const emptyCounts = (): Record<SlotStatus, number> => ({ free: 0, booked: 0, occupied: 0, closed: 0 });

export function groupSlots(rows: SlotRow[]): ClubSlots[] {
  return group(rows, (r) => cellKey(r.slot, r.gender));
}

export function groupMirrors(rows: MirrorRow[]): ClubSlots[] {
  return group(rows, (r) => r.gender);
}

function group<T extends MirrorRow>(rows: T[], key: (r: T) => string): ClubSlots[] {
  const map = new Map<string, ClubSlots>();
  for (const r of rows) {
    let club = map.get(r.club_id);
    if (!club) {
      club = {
        club_id: r.club_id,
        club_name: r.club_name,
        network: r.network,
        manager_id: r.manager_id,
        manager_name: r.manager_name,
        cells: {},
        counts: emptyCounts(),
      };
      map.set(r.club_id, club);
    }
    club.cells[key(r)] = {
      status: r.status,
      campaign_id: r.campaign_id,
      campaign_label: r.campaign_label,
      reason: r.reason,
      source: r.source,
    };
    club.counts[r.status] += 1;
  }
  return [...map.values()].sort((a, b) => a.club_name.localeCompare(b.club_name, 'ru'));
}
