'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import {
  STATUS_COLOR,
  STATUS_ORDER,
  STATUS_TEXT,
  VISIT_LABEL,
  formatPeriod,
  groupCampaigns,
  type CampaignCard,
  type PlacementRow,
} from '@/lib/placements';
import { monthLabel, monthOptions, num } from '@/lib/format';
import { StatCard } from './StatCard';
import { IconCheck, IconSearch } from './Icons';

export function ManagerDashboard({
  manager,
  clubsCount,
  rows,
  month,
}: {
  manager: { name: string; slug: string };
  clubsCount: number;
  rows: PlacementRow[];
  month: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const campaigns = useMemo(() => groupCampaigns(rows), [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return campaigns;
    return campaigns.filter((c) =>
      `${c.campaign_label} ${c.client} ${c.networks.join(' ')}`.toLowerCase().includes(q),
    );
  }, [campaigns, query]);

  const totals = useMemo(() => {
    const acc: Record<string, number> = { одобрено: 0, 'ждём_ответа': 0, 'не_отправлена': 0 };
    let placements = 0;
    const clubs = new Set<string>();
    for (const c of campaigns) {
      placements += c.placements;
      for (const k of STATUS_ORDER) acc[k] += c.counts[k] ?? 0;
      c.clubs.forEach((cl) => clubs.add(cl.club_name));
    }
    return { acc, placements, clubs: clubs.size };
  }, [campaigns]);

  const opened = filtered.find((c) => c.campaign_id === openId) ?? null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/" className="text-sm text-ink-500 hover:text-brand-600 dark:text-ink-400">
            ← К дашборду
          </Link>
          <h1 className="mt-2 text-xl font-semibold tracking-tight">{manager.name}</h1>
          <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">
            {monthLabel(month)} · {num(clubsCount)} клубов в ведении · {campaigns.length} кампаний
          </p>
        </div>

        <select
          value={month}
          onChange={(e) =>
            startTransition(() => router.push(`/managers/${manager.slug}?month=${e.target.value}`, { scroll: false }))
          }
          className="input w-auto"
        >
          {monthOptions(-6, 12).map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="Клубов в ведении" value={num(clubsCount)} />
        <StatCard label="Кампаний" value={num(campaigns.length)} accent="brand" />
        <StatCard label="Размещений" value={num(totals.placements)} hint={`клубов: ${totals.clubs}`} />
        <StatCard label="Одобрено" value={num(totals.acc['одобрено'])} accent="green" />
        <StatCard
          label="Ждём ответ"
          value={num(totals.acc['ждём_ответа'])}
          accent={totals.acc['ждём_ответа'] ? 'amber' : 'grey'}
          hint={`не отправлено: ${totals.acc['не_отправлена']}`}
        />
      </div>

      <div className="card p-3">
        <div className="relative">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по кампании, клиенту или сети…"
            className="input pl-9"
          />
        </div>
      </div>

      {pending && <div className="text-xs text-ink-500">Обновляем…</div>}

      {filtered.length === 0 ? (
        <div className="card grid place-items-center px-6 py-16 text-center">
          <div className="max-w-sm">
            <div className="text-sm font-medium">Кампаний нет</div>
            <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
              В {monthLabel(month).toLowerCase()} по клубам этого менеджера размещений не заведено.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {filtered.map((c) => (
            <CampaignTile
              key={c.campaign_id}
              card={c}
              active={openId === c.campaign_id}
              onClick={() => setOpenId(openId === c.campaign_id ? null : c.campaign_id)}
            />
          ))}
        </div>
      )}

      {opened && <CampaignDetails card={opened} month={month} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function CampaignTile({
  card,
  active,
  onClick,
}: {
  card: CampaignCard;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`card flex flex-col items-center p-4 text-center transition-shadow hover:shadow-pop ${
        active ? 'ring-2 ring-brand-500' : ''
      }`}
    >
      <div className="text-sm font-semibold leading-tight">{card.campaign_label}</div>
      <div className="mt-0.5 text-[11px] text-ink-500 dark:text-ink-400">
        {card.client} · {card.placements}{' '}
        {card.placements === 1 ? 'размещение' : card.placements < 5 ? 'размещения' : 'размещений'}
      </div>

      <Donut counts={card.counts} total={card.placements} />

      <ul className="mt-3 w-full space-y-0.5 text-left text-[11px]">
        {STATUS_ORDER.map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: STATUS_COLOR[s] }} />
            <span className="text-ink-600 dark:text-ink-300">
              {STATUS_TEXT[s]}: {card.counts[s] ?? 0}
            </span>
          </li>
        ))}
      </ul>

      <span className="mt-3 text-[10px] uppercase tracking-wide text-ink-400">
        {active ? 'скрыть' : 'нажмите для подробностей'}
      </span>
    </button>
  );
}

function Donut({ counts, total }: { counts: Record<string, number>; total: number }) {
  const size = 104;
  const stroke = 13;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;

  let offset = 0;
  const arcs = STATUS_ORDER.map((s) => {
    const value = counts[s] ?? 0;
    const len = total > 0 ? (value / total) * circ : 0;
    const arc = { s, len, offset };
    offset += len;
    return arc;
  }).filter((a) => a.len > 0);

  return (
    <div className="relative mt-3" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-ink-100 dark:text-white/10" />
        {arcs.map((a) => (
          <circle
            key={a.s}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={STATUS_COLOR[a.s]}
            strokeWidth={stroke}
            strokeDasharray={`${a.len} ${circ - a.len}`}
            strokeDashoffset={-a.offset}
          />
        ))}
      </svg>
      <span className="absolute inset-0 grid place-items-center text-2xl font-semibold tabular-nums">
        {total}
      </span>
    </div>
  );
}

function CampaignDetails({
  card,
  month,
  onClose,
}: {
  card: CampaignCard;
  month: string;
  onClose: () => void;
}) {
  return (
    <div className="card overflow-hidden border-l-4 border-l-brand-500">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-200/70 px-4 py-3 dark:border-white/10">
        <div>
          <div className="text-xs text-ink-500 dark:text-ink-400">Бренд: {card.client}</div>
          <h2 className="text-base font-semibold">{card.campaign_label}</h2>
          <div className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">
            Период: {formatPeriod(card.periodStart, card.periodEnd)}
            {card.networks.length > 0 && ` · ${card.networks.join(', ')}`}
          </div>
          <div className="text-xs text-ink-400">
            Показаны клубы и форматы, активные в {monthLabel(month).toLowerCase()}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="chip bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/25">
            {card.counts['не_отправлена'] ?? 0} не отправлено · {card.counts['ждём_ответа'] ?? 0} ждём ответа ·{' '}
            {card.counts['одобрено'] ?? 0} одобрено
          </span>
          <button onClick={onClose} className="btn-ghost">
            Скрыть
          </button>
        </div>
      </div>

      <div className="scroll-thin overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse">
          <thead className="bg-ink-50/60 dark:bg-white/5">
            <tr>
              <th className="th">Клуб</th>
              <th className="th">Форматы</th>
              <th className="th">Кто едет</th>
              <th className="th">Фотоотчёт</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-200/60 dark:divide-white/5">
            {card.clubs.map((club) => (
              <tr key={club.club_name} className="hover:bg-ink-50/60 dark:hover:bg-white/5">
                <td className="td">
                  <div className="font-medium">{club.club_name}</div>
                  {club.city && <div className="text-[11px] text-ink-400">{club.city}</div>}
                </td>
                <td className="td">
                  <div className="flex flex-wrap gap-1.5">
                    {club.surfaces.map((s) => (
                      <span
                        key={s.surface_club_id}
                        className="chip"
                        style={{
                          background: `${STATUS_COLOR[s.status_code]}1a`,
                          color: STATUS_COLOR[s.status_code],
                          boxShadow: `inset 0 0 0 1px ${STATUS_COLOR[s.status_code]}55`,
                        }}
                        title={STATUS_TEXT[s.status_code]}
                      >
                        {s.status_code === 'одобрено' && <IconCheck className="h-3 w-3" />}
                        {s.format}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="td">
                  <div className="flex flex-wrap gap-1.5">
                    {[...new Set(club.surfaces.map((s) => s.visit_type))].map((v) => (
                      <span
                        key={v}
                        className="chip bg-ink-100 text-ink-600 ring-ink-200 dark:bg-white/5 dark:text-ink-300 dark:ring-white/10"
                      >
                        {VISIT_LABEL[v] ?? v}
                      </span>
                    ))}
                    {club.surfaces
                      .map((s) => s.executor_name)
                      .filter((n, i, arr): n is string => Boolean(n) && arr.indexOf(n) === i)
                      .map((n) => (
                        <span key={n} className="text-[11px] text-ink-500 dark:text-ink-400">
                          {n}
                        </span>
                      ))}
                  </div>
                </td>
                <td className="td">
                  {club.surfaces.some((s) => s.fo_submitted) ? (
                    <span className="chip bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25">
                      ФО сдан
                    </span>
                  ) : (
                    <span className="chip bg-ink-100 text-ink-500 ring-ink-200 dark:bg-white/5 dark:text-ink-400 dark:ring-white/10">
                      нет
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
