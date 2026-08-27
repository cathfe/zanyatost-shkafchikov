'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  PHOTO_HEX,
  PHOTO_LABEL,
  PHOTO_STATUSES,
  PLACEMENT_STATUSES,
  PLACEMENT_STATUS_DETAILS,
  PLACEMENT_STATUS_HEX,
  PLACEMENT_STATUS_LABEL,
  VISIT_LABEL,
  VISIT_TYPES,
  formatPeriod,
  type Campaign,
  type Placement,
  type PlacementStatus,
  type PhotoStatus,
  type VisitType,
} from '@/lib/placements';
import { monthLabel, monthOptions, num } from '@/lib/format';
import { updatePlacement } from '@/app/admin/actions';
import { StatCard } from './StatCard';
import { IconAlert, IconCheck, IconSearch } from './Icons';

export function ManagerDashboard({
  manager,
  clubsCount,
  campaigns,
  month,
  canEdit,
}: {
  manager: { name: string; slug: string };
  clubsCount: number;
  campaigns: Campaign[];
  month: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(campaigns[0]?.id ?? null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return campaigns;
    return campaigns.filter((c) => `${c.label} ${c.client}`.toLowerCase().includes(q));
  }, [campaigns, query]);

  const totals = useMemo(() => {
    const st: Record<PlacementStatus, number> = { not_sent: 0, waiting: 0, approved: 0, declined: 0 };
    const ph: Record<PhotoStatus, number> = { expected: 0, received: 0, overdue: 0 };
    let placements = 0;
    let tasksDone = 0;
    for (const c of campaigns) {
      placements += c.placements.length;
      for (const s of PLACEMENT_STATUSES) st[s] += c.counts[s];
      for (const p of PHOTO_STATUSES) ph[p] += c.photo[p];
      tasksDone += c.placements.filter((p) => p.tasks_done).length;
    }
    return { st, ph, placements, tasksDone };
  }, [campaigns]);

  const notify = (ok: boolean, text: string) => {
    setToast({ ok, text });
    setTimeout(() => setToast(null), 3000);
  };

  const patch = async (p: Placement, changes: Parameters<typeof updatePlacement>[0]['patch']) => {
    setBusy(p.id);
    const res = await updatePlacement({ id: p.id, clubName: p.club_name, patch: changes });
    setBusy(null);
    notify(res.ok, res.ok ? 'Сохранено' : res.error);
    if (res.ok) router.refresh();
  };

  const opened = filtered.find((c) => c.id === openId) ?? null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/" className="text-sm text-ink-500 hover:text-brand-600 dark:text-ink-400">
            ← К дашборду
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight">{manager.name}</h1>
            <span className="chip bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/25">
              демонстрационные данные
            </span>
          </div>
          <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">
            {monthLabel(month)} · {num(clubsCount)} клубов в ведении · {campaigns.length} кампаний
          </p>
        </div>

        <select
          value={month}
          onChange={(e) => router.push(`/managers/${manager.slug}?month=${e.target.value}`)}
          className="input w-auto"
        >
          {monthOptions(-6, 12).map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
      </div>

      {/* Общая информация сверху */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="Клубов в ведении" value={num(clubsCount)} />
        <StatCard label="Кампаний" value={num(campaigns.length)} accent="brand" />
        <StatCard label="Размещений" value={num(totals.placements)} />
        <StatCard label="Одобрено" value={num(totals.st.approved)} accent="green" />
        <StatCard
          label="Ждём ответ"
          value={num(totals.st.waiting)}
          accent={totals.st.waiting ? 'amber' : 'grey'}
          hint={`не отправлено: ${totals.st.not_sent}`}
        />
      </div>

      {/* Фотоотчёт — отдельный контролируемый показатель */}
      <section className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Фотоотчёт</h2>
            <p className="text-xs text-ink-500 dark:text-ink-400">
              Отдельный контроль: сколько получено, сколько ждём, сколько просрочено
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {PHOTO_STATUSES.map((s) => (
              <div
                key={s}
                className="flex items-center gap-2 rounded-lg border border-ink-200/70 px-3 py-2 dark:border-white/10"
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: PHOTO_HEX[s] }} />
                <span className="text-xs text-ink-500 dark:text-ink-400">{PHOTO_LABEL[s]}</span>
                <span className="text-base font-semibold tabular-nums">{totals.ph[s]}</span>
              </div>
            ))}
          </div>
        </div>

        {totals.ph.overdue > 0 && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-500/10 dark:text-rose-200">
            <IconAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {totals.ph.overdue} фотоотчётов просрочено — их видно в таблице кампании.
          </div>
        )}
      </section>

      <div className="card p-3">
        <div className="relative">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по кампании или клиенту…"
            className="input pl-9"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card grid place-items-center px-6 py-16 text-center">
          <div className="max-w-sm">
            <div className="text-sm font-medium">Кампаний нет</div>
            <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
              В {monthLabel(month).toLowerCase()} у этого менеджера размещений не заведено.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {filtered.map((c) => (
            <CampaignTile
              key={c.id}
              campaign={c}
              active={openId === c.id}
              onClick={() => setOpenId(openId === c.id ? null : c.id)}
            />
          ))}
        </div>
      )}

      {opened && (
        <CampaignTable
          campaign={opened}
          canEdit={canEdit}
          busyId={busy}
          onPatch={patch}
          onClose={() => setOpenId(null)}
        />
      )}

      {toast && (
        <div
          className={`fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-2.5 text-sm text-white shadow-pop ${
            toast.ok ? 'bg-emerald-600' : 'bg-rose-600'
          }`}
        >
          <span className="inline-flex items-center gap-2">
            {toast.ok ? <IconCheck /> : <IconAlert />}
            {toast.text}
          </span>
        </div>
      )}
    </div>
  );
}

function CampaignTile({
  campaign,
  active,
  onClick,
}: {
  campaign: Campaign;
  active: boolean;
  onClick: () => void;
}) {
  const total = campaign.placements.length;

  return (
    <button
      onClick={onClick}
      className={`card flex flex-col items-center p-4 text-center transition-shadow hover:shadow-pop ${
        active ? 'ring-2 ring-brand-500' : ''
      }`}
    >
      <div className="text-sm font-semibold leading-tight">{campaign.label}</div>
      <div className="mt-0.5 text-[11px] text-ink-500 dark:text-ink-400">
        {campaign.client} · {total} {total === 1 ? 'размещение' : total < 5 ? 'размещения' : 'размещений'}
      </div>

      <Donut counts={campaign.counts} total={total} />

      <ul className="mt-3 w-full space-y-0.5 text-left text-[11px]">
        {PLACEMENT_STATUSES.filter((s) => campaign.counts[s] > 0 || s !== 'declined').map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: PLACEMENT_STATUS_HEX[s] }} />
            <span className="text-ink-600 dark:text-ink-300">
              {PLACEMENT_STATUS_LABEL[s].toLowerCase()}: {campaign.counts[s]}
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

function Donut({ counts, total }: { counts: Record<PlacementStatus, number>; total: number }) {
  const size = 104;
  const stroke = 13;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;

  let offset = 0;
  const arcs = PLACEMENT_STATUSES.map((s) => {
    const len = total > 0 ? (counts[s] / total) * circ : 0;
    const arc = { s, len, offset };
    offset += len;
    return arc;
  }).filter((a) => a.len > 0);

  return (
    <div className="relative mt-3" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-ink-100 dark:text-white/10"
        />
        {arcs.map((a) => (
          <circle
            key={a.s}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={PLACEMENT_STATUS_HEX[a.s]}
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

function CampaignTable({
  campaign,
  canEdit,
  busyId,
  onPatch,
  onClose,
}: {
  campaign: Campaign;
  canEdit: boolean;
  busyId: string | null;
  onPatch: (p: Placement, patch: Parameters<typeof updatePlacement>[0]['patch']) => void;
  onClose: () => void;
}) {
  return (
    <div className="card overflow-hidden border-l-4 border-l-brand-500">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-200/70 px-4 py-3 dark:border-white/10">
        <div>
          <div className="text-xs text-ink-500 dark:text-ink-400">Бренд: {campaign.client}</div>
          <h2 className="text-base font-semibold">{campaign.label}</h2>
          <div className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">
            Период: {formatPeriod(campaign.period_start, campaign.period_end)}
          </div>
        </div>
        <button onClick={onClose} className="btn-ghost">
          Скрыть
        </button>
      </div>

      <div className="scroll-thin overflow-x-auto">
        <table className="w-full min-w-[880px] border-collapse">
          <thead className="bg-ink-50/60 dark:bg-white/5">
            <tr>
              <th className="th">Клуб</th>
              <th className="th">Формат</th>
              <th className="th">Статус</th>
              <th className="th">Кто едет</th>
              <th className="th">Фотоотчёт</th>
              <th className="th text-center">Задачи</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-200/60 dark:divide-white/5">
            {campaign.placements.map((p) => (
              <tr key={p.id} className="align-top hover:bg-ink-50/60 dark:hover:bg-white/5">
                <td className="td">
                  <div className="font-medium">{p.club_name}</div>
                  <div className="text-[11px] text-ink-400">{p.network ?? 'без сети'}</div>
                </td>
                <td className="td text-ink-500 dark:text-ink-400">{p.format}</td>

                <td className="td">
                  <StatusBlock placement={p} canEdit={canEdit} busy={busyId === p.id} onPatch={onPatch} />
                </td>

                <td className="td">
                  {canEdit ? (
                    <div className="space-y-1.5">
                      <select
                        value={p.visit_type}
                        disabled={busyId === p.id}
                        onChange={(e) => onPatch(p, { visit_type: e.target.value as VisitType })}
                        className="input py-1 text-xs"
                      >
                        {VISIT_TYPES.map((v) => (
                          <option key={v} value={v}>
                            {VISIT_LABEL[v]}
                          </option>
                        ))}
                      </select>
                      <input
                        defaultValue={p.assignee ?? ''}
                        disabled={busyId === p.id}
                        placeholder="ответственный"
                        onBlur={(e) => {
                          const v = e.target.value.trim() || null;
                          if (v !== p.assignee) onPatch(p, { assignee: v });
                        }}
                        className="input py-1 text-xs"
                      />
                    </div>
                  ) : (
                    <div>
                      <span className="chip bg-ink-100 text-ink-600 ring-ink-200 dark:bg-white/5 dark:text-ink-300 dark:ring-white/10">
                        {VISIT_LABEL[p.visit_type]}
                      </span>
                      {p.assignee && <div className="mt-1 text-[11px] text-ink-500">{p.assignee}</div>}
                    </div>
                  )}
                </td>

                <td className="td">
                  {canEdit ? (
                    <select
                      value={p.photo_status}
                      disabled={busyId === p.id}
                      onChange={(e) => onPatch(p, { photo_status: e.target.value as PhotoStatus })}
                      className="input py-1 text-xs"
                      style={{ color: PHOTO_HEX[p.photo_status] }}
                    >
                      {PHOTO_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {PHOTO_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span
                      className="chip"
                      style={{
                        background: `${PHOTO_HEX[p.photo_status]}1a`,
                        color: PHOTO_HEX[p.photo_status],
                        boxShadow: `inset 0 0 0 1px ${PHOTO_HEX[p.photo_status]}55`,
                      }}
                    >
                      {PHOTO_LABEL[p.photo_status]}
                    </span>
                  )}
                  {p.photo_due && (
                    <div className="mt-1 text-[11px] text-ink-400">до {formatDue(p.photo_due)}</div>
                  )}
                </td>

                <td className="td text-center">
                  <input
                    type="checkbox"
                    checked={p.tasks_done}
                    disabled={!canEdit || busyId === p.id}
                    onChange={(e) => onPatch(p, { tasks_done: e.target.checked })}
                    className="h-4 w-4 rounded border-ink-300 text-brand-600"
                    title="Задачи по размещению выполнены"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Статус как раскрывающийся блок: не просто слово, а «что именно». */
function StatusBlock({
  placement,
  canEdit,
  busy,
  onPatch,
}: {
  placement: Placement;
  canEdit: boolean;
  busy: boolean;
  onPatch: (p: Placement, patch: Parameters<typeof updatePlacement>[0]['patch']) => void;
}) {
  const [open, setOpen] = useState(false);
  const hex = PLACEMENT_STATUS_HEX[placement.status];

  return (
    <div className="min-w-[190px]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="chip w-full justify-between"
        style={{ background: `${hex}1a`, color: hex, boxShadow: `inset 0 0 0 1px ${hex}55` }}
      >
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: hex }} />
          {PLACEMENT_STATUS_LABEL[placement.status]}
        </span>
        <span className="text-[10px] opacity-70">{open ? '▲' : '▼'}</span>
      </button>

      {placement.status_detail && !open && (
        <div className="mt-1 text-[11px] text-ink-500 dark:text-ink-400">{placement.status_detail}</div>
      )}

      {open && (
        <div className="mt-2 rounded-lg border border-ink-200/70 p-2 dark:border-white/10">
          <div className="mb-1.5 text-[10px] uppercase tracking-wide text-ink-400">Статус</div>
          <div className="flex flex-wrap gap-1">
            {PLACEMENT_STATUSES.map((s) => (
              <button
                key={s}
                disabled={!canEdit || busy}
                onClick={() => onPatch(placement, { status: s, status_detail: null })}
                className={`rounded-md px-2 py-1 text-[11px] ring-1 ring-inset transition-colors ${
                  placement.status === s
                    ? 'bg-ink-900 text-white ring-ink-900 dark:bg-white dark:text-ink-900 dark:ring-white'
                    : 'text-ink-600 ring-ink-200 hover:bg-ink-50 dark:text-ink-300 dark:ring-white/10'
                }`}
              >
                {PLACEMENT_STATUS_LABEL[s]}
              </button>
            ))}
          </div>

          <div className="mb-1.5 mt-3 text-[10px] uppercase tracking-wide text-ink-400">
            {placement.status === 'waiting'
              ? 'Что именно ожидаем'
              : placement.status === 'not_sent'
                ? 'Почему не отправлено'
                : placement.status === 'declined'
                  ? 'Причина отказа'
                  : 'Уточнение'}
          </div>
          <div className="flex flex-wrap gap-1">
            {PLACEMENT_STATUS_DETAILS[placement.status].map((d) => (
              <button
                key={d}
                disabled={!canEdit || busy}
                onClick={() => onPatch(placement, { status_detail: d })}
                className={`rounded-md px-2 py-1 text-[11px] ring-1 ring-inset transition-colors ${
                  placement.status_detail === d
                    ? 'bg-brand-600 text-white ring-brand-600'
                    : 'text-ink-600 ring-ink-200 hover:bg-ink-50 dark:text-ink-300 dark:ring-white/10'
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          {placement.note && (
            <p className="mt-2 border-t border-ink-200/70 pt-2 text-[11px] text-ink-500 dark:border-white/10 dark:text-ink-400">
              {placement.note}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function formatDue(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y.slice(2)}`;
}
