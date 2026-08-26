/**
 * Дашборд менеджера — контракт данных.
 *
 * Сейчас данные приходят из mock-источника. Когда корпоративная база будет
 * согласована, достаточно написать второй источник с этим же интерфейсом
 * и переключить его в `src/lib/manager-dashboard/index.ts` — страницы,
 * компоненты и типы менять не придётся.
 */

export type ZayavkaStatus = 'черновик' | 'отправлена' | 'согласована' | 'отклонена';

export const ZAYAVKA_STATUS_ORDER: ZayavkaStatus[] = [
  'черновик',
  'отправлена',
  'согласована',
  'отклонена',
];

/** Заявка на размещение рекламных материалов в фитнес-клубах. */
export type Zayavka = {
  id: string;
  client: string;
  network: string;
  /** Вид размещения: «Стикеры в шкафах», «Мониторы», «Стикеры на зеркалах» и т.д. */
  format: string;
  periodStart: string; // ISO
  periodEnd: string; // ISO
  clubsCount: number;
  surfacesCount: number;
  budget: number;
  status: ZayavkaStatus;
  /** Приложен ли макет — в документе заявки это поле «Макет:» */
  macetAttached: boolean;
  /** Согласовано ли превью-кадр */
  previewApproved: boolean;
  updatedAt: string; // ISO
};

export type ManagerKpi = {
  activeCampaigns: number;
  zayavkiInProgress: number;
  clubsInWork: number;
  budgetMonth: number;
  /** Сколько заявок ждут макета — то, что чаще всего тормозит запуск */
  waitingForMacet: number;
};

export type MonthlyPoint = {
  month: string; // ISO, первое число
  budget: number;
  clubs: number;
};

export type ManagerDashboard = {
  managerSlug: string;
  managerName: string;
  /** Откуда пришли данные — показывается в интерфейсе, чтобы не путать mock с боевыми */
  source: 'mock' | 'supabase';
  kpi: ManagerKpi;
  zayavki: Zayavka[];
  monthly: MonthlyPoint[];
  /** Сети, с которыми работает менеджер, с числом клубов */
  networks: { name: string; clubs: number }[];
};

export interface ManagerDashboardSource {
  getDashboard(managerSlug: string): Promise<ManagerDashboard | null>;
}
