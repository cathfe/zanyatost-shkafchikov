/** Строка из SQL-функции lockers_manager_placements(manager_slug, month) */
export type PlacementRow = {
  campaign_id: string;
  campaign_label: string;
  client: string;
  surface_id: string;
  network: string | null;
  format: string;
  format_type: string;
  surface_club_id: string;
  club_name: string;
  city: string | null;
  manager_slug: string | null;
  manager_name: string | null;
  status_code: string;
  status_label: string | null;
  status_order: number | null;
  visit_type: string;
  executor_name: string | null;
  fo_submitted: boolean;
  approved: boolean;
  period_start: string | null;
  period_end: string | null;
};

export const STATUS_ORDER = ['одобрено', 'ждём_ответа', 'не_отправлена'] as const;
export type PlacementStatus = (typeof STATUS_ORDER)[number];

export const STATUS_TEXT: Record<string, string> = {
  одобрено: 'одобрено',
  'ждём_ответа': 'ждём ответ',
  'не_отправлена': 'не отправлено',
};

export const STATUS_COLOR: Record<string, string> = {
  одобрено: '#16a34a',
  'ждём_ответа': '#f59e0b',
  'не_отправлена': '#9ca3af',
};

export const VISIT_LABEL: Record<string, string> = {
  сам: 'САМ',
  монтажник: 'МОНТАЖНИК',
  бтл: 'БТЛ',
};

export type CampaignClub = {
  club_name: string;
  city: string | null;
  surfaces: {
    surface_club_id: string;
    format: string;
    format_type: string;
    network: string | null;
    status_code: string;
    visit_type: string;
    executor_name: string | null;
    fo_submitted: boolean;
  }[];
};

export type CampaignCard = {
  campaign_id: string;
  campaign_label: string;
  client: string;
  networks: string[];
  placements: number;
  counts: Record<string, number>;
  periodStart: string | null;
  periodEnd: string | null;
  clubs: CampaignClub[];
};

/** Собирает плоские строки в карточки кампаний, как на дашборде. */
export function groupCampaigns(rows: PlacementRow[]): CampaignCard[] {
  const byCampaign = new Map<string, CampaignCard>();
  const clubsByCampaign = new Map<string, Map<string, CampaignClub>>();

  for (const r of rows) {
    let card = byCampaign.get(r.campaign_id);
    if (!card) {
      card = {
        campaign_id: r.campaign_id,
        campaign_label: r.campaign_label,
        client: r.client,
        networks: [],
        placements: 0,
        counts: { одобрено: 0, 'ждём_ответа': 0, 'не_отправлена': 0 },
        periodStart: r.period_start,
        periodEnd: r.period_end,
        clubs: [],
      };
      byCampaign.set(r.campaign_id, card);
      clubsByCampaign.set(r.campaign_id, new Map());
    }

    card.placements += 1;
    card.counts[r.status_code] = (card.counts[r.status_code] ?? 0) + 1;
    if (r.network && !card.networks.includes(r.network)) card.networks.push(r.network);
    if (r.period_start && (!card.periodStart || r.period_start < card.periodStart)) card.periodStart = r.period_start;
    if (r.period_end && (!card.periodEnd || r.period_end > card.periodEnd)) card.periodEnd = r.period_end;

    const clubs = clubsByCampaign.get(r.campaign_id)!;
    let club = clubs.get(r.club_name);
    if (!club) {
      club = { club_name: r.club_name, city: r.city, surfaces: [] };
      clubs.set(r.club_name, club);
    }
    club.surfaces.push({
      surface_club_id: r.surface_club_id,
      format: r.format,
      format_type: r.format_type,
      network: r.network,
      status_code: r.status_code,
      visit_type: r.visit_type,
      executor_name: r.executor_name,
      fo_submitted: r.fo_submitted,
    });
  }

  for (const [id, clubs] of clubsByCampaign) {
    const card = byCampaign.get(id)!;
    card.clubs = [...clubs.values()].sort((a, b) => a.club_name.localeCompare(b.club_name, 'ru'));
  }

  return [...byCampaign.values()].sort(
    (a, b) => b.placements - a.placements || a.campaign_label.localeCompare(b.campaign_label, 'ru'),
  );
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
