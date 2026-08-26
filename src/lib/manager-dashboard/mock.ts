/**
 * Mock-источник дашборда менеджера.
 *
 * Данные вымышленные и помечены как mock в интерфейсе. Структура намеренно
 * повторяет реальную заявку на размещение (клиент, вид размещения, период,
 * число клубов и поверхностей, бюджет, макет/превью) — чтобы при подключении
 * корпоративной базы поменялся только источник, а не экраны.
 */

import type { ManagerDashboard, ManagerDashboardSource, Zayavka } from './types';

const MONTHS = ['2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01'];

function build(
  slug: string,
  name: string,
  networks: { name: string; clubs: number }[],
  zayavki: Zayavka[],
  monthlyBudget: number[],
  monthlyClubs: number[],
): ManagerDashboard {
  const inProgress = zayavki.filter((z) => z.status === 'черновик' || z.status === 'отправлена');
  const approved = zayavki.filter((z) => z.status === 'согласована');

  return {
    managerSlug: slug,
    managerName: name,
    source: 'mock',
    kpi: {
      activeCampaigns: approved.length,
      zayavkiInProgress: inProgress.length,
      clubsInWork: approved.reduce((a, z) => a + z.clubsCount, 0),
      budgetMonth: approved.reduce((a, z) => a + z.budget, 0),
      waitingForMacet: zayavki.filter((z) => !z.macetAttached && z.status !== 'отклонена').length,
    },
    zayavki,
    monthly: MONTHS.map((month, i) => ({
      month,
      budget: monthlyBudget[i] ?? 0,
      clubs: monthlyClubs[i] ?? 0,
    })),
    networks,
  };
}

const z = (
  id: string,
  client: string,
  network: string,
  format: string,
  periodStart: string,
  periodEnd: string,
  clubsCount: number,
  surfacesCount: number,
  budget: number,
  status: Zayavka['status'],
  macetAttached: boolean,
  previewApproved: boolean,
  updatedAt: string,
): Zayavka => ({
  id,
  client,
  network,
  format,
  periodStart,
  periodEnd,
  clubsCount,
  surfacesCount,
  budget,
  status,
  macetAttached,
  previewApproved,
  updatedAt,
});

const DATA: Record<string, ManagerDashboard> = {
  'ekaterina-n': build(
    'ekaterina-n',
    'Екатерина Н',
    [
      { name: 'Alex Fitness', clubs: 22 },
      { name: 'Колизей', clubs: 13 },
      { name: 'Физкульт', clubs: 11 },
      { name: 'Drive Fitness', clubs: 15 },
      { name: 'Палестра', clubs: 5 },
    ],
    [
      z('mock-n-1', 'ВкусВилл', 'Alex Fitness', 'Стикеры в шкафах', '2026-09-01', '2026-12-31', 12, 1507, 2472391, 'согласована', true, true, '2026-08-18T10:20:00Z'),
      z('mock-n-2', 'Магнит', 'Колизей', 'Мониторы', '2026-09-01', '2026-10-31', 8, 24, 240000, 'согласована', true, true, '2026-08-14T09:05:00Z'),
      z('mock-n-3', 'Спортмастер', 'Физкульт', 'Стикеры в шкафах', '2026-10-01', '2026-11-30', 10, 640, 1344000, 'отправлена', true, false, '2026-08-22T14:40:00Z'),
      z('mock-n-4', 'Т-Банк', 'Drive Fitness', 'Стикеры на зеркалах', '2026-10-01', '2026-12-31', 15, 30, 468000, 'черновик', false, false, '2026-08-25T08:15:00Z'),
      z('mock-n-5', 'Синергия', 'Палестра', 'Мониторы', '2026-08-01', '2026-08-31', 5, 15, 93750, 'отклонена', true, false, '2026-07-30T16:00:00Z'),
    ],
    [1_820_000, 2_140_000, 1_960_000, 2_480_000, 3_010_000, 2_760_000],
    [28, 34, 31, 38, 45, 41],
  ),

  'ekaterina-l': build(
    'ekaterina-l',
    'Екатерина Л',
    [
      { name: 'Powerhouse Gym', clubs: 6 },
      { name: 'Spirit Fitness', clubs: 3 },
      { name: 'Orange Fitness', clubs: 3 },
      { name: 'ULTRA', clubs: 3 },
      { name: 'Европа', clubs: 5 },
    ],
    [
      z('mock-l-1', 'Пятёрочка', 'Powerhouse Gym', 'Стикеры в шкафах', '2026-09-01', '2026-11-30', 6, 420, 756000, 'согласована', true, true, '2026-08-19T11:30:00Z'),
      z('mock-l-2', 'Ozon', 'Европа', 'Мониторы', '2026-09-15', '2026-10-15', 5, 15, 150000, 'отправлена', true, false, '2026-08-21T13:10:00Z'),
      z('mock-l-3', 'Литрес', 'Spirit Fitness', 'Стикеры на зеркалах', '2026-10-01', '2026-10-31', 3, 6, 54000, 'черновик', false, false, '2026-08-24T17:45:00Z'),
      z('mock-l-4', 'Самокат', 'Orange Fitness', 'Стикеры в шкафах', '2026-08-01', '2026-09-30', 3, 186, 279000, 'согласована', true, true, '2026-07-28T10:00:00Z'),
    ],
    [640_000, 720_000, 810_000, 905_000, 1_140_000, 980_000],
    [9, 11, 12, 14, 17, 15],
  ),

  'kristina-f': build(
    'kristina-f',
    'Кристина Ф',
    [
      { name: 'Bright Fit', clubs: 31 },
      { name: 'MetroFitness', clubs: 17 },
      { name: 'XFIT', clubs: 13 },
      { name: 'Energy Fitness', clubs: 7 },
      { name: 'Атлетик', clubs: 7 },
    ],
    [
      z('mock-k-1', 'Сбер', 'Bright Fit', 'Стикеры в шкафах', '2026-09-01', '2026-12-31', 31, 2480, 4340000, 'согласована', true, true, '2026-08-20T09:40:00Z'),
      z('mock-k-2', 'Яндекс Еда', 'MetroFitness', 'Мониторы', '2026-09-01', '2026-11-30', 17, 51, 765000, 'согласована', true, true, '2026-08-12T15:25:00Z'),
      z('mock-k-3', 'Мегамаркет', 'XFIT', 'Стикеры в шкафах', '2026-10-01', '2026-12-31', 13, 910, 1638000, 'отправлена', false, false, '2026-08-25T12:05:00Z'),
      z('mock-k-4', 'Аптека Апрель', 'Energy Fitness', 'Стикеры на зеркалах', '2026-10-01', '2026-11-30', 7, 14, 126000, 'черновик', false, false, '2026-08-26T07:50:00Z'),
      z('mock-k-5', 'Авито', 'Атлетик', 'Мониторы', '2026-08-01', '2026-09-30', 7, 21, 294000, 'согласована', true, true, '2026-07-25T14:15:00Z'),
    ],
    [3_100_000, 3_540_000, 3_280_000, 4_120_000, 5_530_000, 4_890_000],
    [42, 48, 45, 55, 68, 61],
  ),
};

export const mockSource: ManagerDashboardSource = {
  async getDashboard(slug: string) {
    return DATA[slug] ?? null;
  },
};

export const MOCK_MANAGER_SLUGS = Object.keys(DATA);
