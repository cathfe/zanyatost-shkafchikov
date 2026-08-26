export type Gender = 'male' | 'female';
export type Slot = 1 | 2;
export type SurfaceType = 'lockers' | 'mirrors';
export type CellStatus = 'available' | 'occupied' | 'reserved' | 'closed';
export type Role = 'admin' | 'editor' | 'viewer';

export const GENDERS: Gender[] = ['male', 'female'];
export const SLOTS: Slot[] = [1, 2];

export const GENDER_LABEL: Record<Gender, string> = {
  male: 'Мужская',
  female: 'Женская',
};

export const SURFACE_LABEL: Record<SurfaceType, string> = {
  lockers: 'Стикеры в шкафах',
  mirrors: 'Стикеры на зеркалах',
};

export const STATUS_LABEL: Record<CellStatus, string> = {
  available: 'Свободно',
  occupied: 'Занято',
  reserved: 'Бронь',
  closed: 'Закрыто',
};

/** Что администратор ставит руками. «Занято» приходит из импорта АП. */
export const MANUAL_STATUSES: CellStatus[] = ['available', 'reserved', 'closed'];

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Администратор',
  editor: 'Редактор',
  viewer: 'Просмотр',
};

export const ROLE_HINT: Record<Role, string> = {
  admin: 'Всё, включая пользователей, клубы и настройки',
  editor: 'Ручные изменения занятости и импорт данных',
  viewer: 'Только просмотр внутренних разделов',
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

/** Строка из SQL-функции lockers_availability(month, surface) */
export type AvailabilityRow = {
  club_id: string;
  club_name: string;
  network: string | null;
  manager_id: string | null;
  manager_name: string | null;
  slot: Slot;
  gender: Gender;
  /** null — количество шкафчиков ещё не заведено */
  total: number | null;
  capacity_known: boolean;
  occupied: number;
  reserved: number;
  /** null, если вместимость неизвестна */
  free: number | null;
  status: CellStatus;
  /** Кампания из импорта АП */
  campaign_label: string | null;
  /** Под кого поставлена бронь */
  reserved_for: string | null;
  note: string | null;
  manual: boolean;
  /** Бронь и занятость из АП на одной раздевалке — надо разобраться */
  conflict: boolean;
  conflict_ack: boolean;
};

/** Строка из SQL-функции lockers_overlaps(month, surface) */
export type OverlapRow = {
  club_id: string;
  club_name: string;
  network: string | null;
  manager_id: string | null;
  manager_name: string | null;
  gender: Gender;
  total: number | null;
  capacity_known: boolean;
  slot1_status: CellStatus;
  slot1_campaign: string | null;
  slot1_reserved_for: string | null;
  slot1_occupied: number;
  slot1_reserved: number;
  slot1_free: number | null;
  slot1_note: string | null;
  slot2_status: CellStatus;
  slot2_campaign: string | null;
  slot2_reserved_for: string | null;
  slot2_occupied: number;
  slot2_reserved: number;
  slot2_free: number | null;
  slot2_note: string | null;
  is_overlap: boolean;
  has_conflict: boolean;
};

export type SlotSide = {
  slot: Slot;
  status: CellStatus;
  campaign: string | null;
  reservedFor: string | null;
  occupied: number;
  reserved: number;
  free: number | null;
  note: string | null;
};

/** Разворачивает строку пересечения в описание одного слота. */
export function slotSide(row: OverlapRow, slot: Slot): SlotSide {
  return slot === 1
    ? {
        slot,
        status: row.slot1_status,
        campaign: row.slot1_campaign,
        reservedFor: row.slot1_reserved_for,
        occupied: row.slot1_occupied,
        reserved: row.slot1_reserved,
        free: row.slot1_free,
        note: row.slot1_note,
      }
    : {
        slot,
        status: row.slot2_status,
        campaign: row.slot2_campaign,
        reservedFor: row.slot2_reserved_for,
        occupied: row.slot2_occupied,
        reserved: row.slot2_reserved,
        free: row.slot2_free,
        note: row.slot2_note,
      };
}

export type MonthSummary = {
  clubs_total: number;
  cells_total: number;
  lockers_total: number;
  lockers_occupied: number;
  lockers_reserved: number;
  lockers_free: number;
  cells_free: number;
  cells_occupied: number;
  cells_reserved: number;
  cells_closed: number;
  cells_conflict: number;
  cells_no_capacity: number;
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
  dashboard_club_id: string | null;
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

export type Cell = Pick<
  AvailabilityRow,
  | 'total'
  | 'capacity_known'
  | 'occupied'
  | 'reserved'
  | 'free'
  | 'status'
  | 'campaign_label'
  | 'reserved_for'
  | 'note'
  | 'manual'
  | 'conflict'
  | 'conflict_ack'
>;

export type ClubRow = {
  club_id: string;
  club_name: string;
  network: string | null;
  manager_id: string | null;
  manager_name: string | null;
  cells: Record<string, Cell>; // ключ `${slot}:${gender}`
  total: number;
  free: number;
  occupied: number;
  reserved: number;
  closedCells: number;
  conflictCells: number;
  knownCells: number;
};

export const cellKey = (slot: Slot | number, gender: Gender) => `${slot}:${gender}`;

export function groupByClub(rows: AvailabilityRow[]): ClubRow[] {
  const map = new Map<string, ClubRow>();
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
        total: 0,
        free: 0,
        occupied: 0,
        reserved: 0,
        closedCells: 0,
        conflictCells: 0,
        knownCells: 0,
      };
      map.set(r.club_id, club);
    }
    club.cells[cellKey(r.slot, r.gender)] = {
      total: r.total,
      capacity_known: r.capacity_known,
      occupied: r.occupied,
      reserved: r.reserved,
      free: r.free,
      status: r.status,
      campaign_label: r.campaign_label,
      reserved_for: r.reserved_for,
      note: r.note,
      manual: r.manual,
      conflict: r.conflict,
      conflict_ack: r.conflict_ack,
    };
    club.total += r.total ?? 0;
    club.free += r.free ?? 0;
    club.occupied += r.occupied;
    club.reserved += r.reserved;
    if (r.capacity_known) club.knownCells += 1;
    if (r.status === 'closed') club.closedCells += 1;
    if (r.conflict && !r.conflict_ack) club.conflictCells += 1;
  }
  return [...map.values()].sort((a, b) => a.club_name.localeCompare(b.club_name, 'ru'));
}
