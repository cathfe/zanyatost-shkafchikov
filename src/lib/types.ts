export type Gender = 'male' | 'female';
export type Slot = 1 | 2;
export type SurfaceType = 'lockers' | 'mirrors';
export type CellStatus = 'available' | 'closed' | 'reserved';

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
  closed: 'Закрыто',
  reserved: 'Бронь',
};

/** Строка, которую отдаёт SQL-функция lockers_availability(month, surface) */
export type AvailabilityRow = {
  club_id: string;
  club_name: string;
  network: string | null;
  city: string | null;
  address: string | null;
  slot: Slot;
  gender: Gender;
  total: number;
  occupied: number;
  reserved: number;
  free: number;
  status: CellStatus;
  campaign_label: string | null;
  note: string | null;
  manual: boolean;
};

export type MonthSummary = {
  clubs_total: number;
  lockers_total: number;
  lockers_occupied: number;
  lockers_reserved: number;
  lockers_free: number;
  slots_closed: number;
  load_percent: number;
};

export type Club = {
  id: string;
  name: string;
  network: string | null;
  city: string | null;
  address: string | null;
  is_active: boolean;
  dashboard_club_id: string | null;
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

/** Клетка сетки: клуб × слот × раздевалка */
export type Cell = Pick<
  AvailabilityRow,
  'total' | 'occupied' | 'reserved' | 'free' | 'status' | 'campaign_label' | 'note' | 'manual'
>;

export type ClubRow = {
  club_id: string;
  club_name: string;
  network: string | null;
  city: string | null;
  address: string | null;
  cells: Record<string, Cell>; // ключ `${slot}:${gender}`
  total: number;
  free: number;
  occupied: number;
  reserved: number;
};

export const cellKey = (slot: Slot | number, gender: Gender) => `${slot}:${gender}`;

/** Группировка плоского ответа SQL в строки по клубам */
export function groupByClub(rows: AvailabilityRow[]): ClubRow[] {
  const map = new Map<string, ClubRow>();
  for (const r of rows) {
    let club = map.get(r.club_id);
    if (!club) {
      club = {
        club_id: r.club_id,
        club_name: r.club_name,
        network: r.network,
        city: r.city,
        address: r.address,
        cells: {},
        total: 0,
        free: 0,
        occupied: 0,
        reserved: 0,
      };
      map.set(r.club_id, club);
    }
    club.cells[cellKey(r.slot, r.gender)] = {
      total: r.total,
      occupied: r.occupied,
      reserved: r.reserved,
      free: r.free,
      status: r.status,
      campaign_label: r.campaign_label,
      note: r.note,
      manual: r.manual,
    };
    club.total += r.total;
    club.free += r.free;
    club.occupied += r.occupied;
    club.reserved += r.reserved;
  }
  return [...map.values()].sort((a, b) => a.club_name.localeCompare(b.club_name, 'ru'));
}
