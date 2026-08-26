import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { StatCard } from '@/components/StatCard';
import { managerDashboardSource, type Zayavka, type ZayavkaStatus } from '@/lib/manager-dashboard';
import { monthShort, num } from '@/lib/format';
import { IconAlert, IconCheck, IconDoc } from '@/components/Icons';

export const dynamic = 'force-dynamic';

const STATUS_STYLE: Record<ZayavkaStatus, string> = {
  черновик: 'bg-ink-100 text-ink-600 ring-ink-200 dark:bg-white/5 dark:text-ink-300 dark:ring-white/10',
  отправлена: 'bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-500/25',
  согласована:
    'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25',
  отклонена: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/25',
};

const money = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
});

function period(z: Zayavka): string {
  const f = (iso: string) => {
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y.slice(2)}`;
  };
  return `${f(z.periodStart)} – ${f(z.periodEnd)}`;
}

export default async function ManagerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await managerDashboardSource().getDashboard(slug);
  if (!data) notFound();

  const maxBudget = Math.max(...data.monthly.map((m) => m.budget), 1);

  return (
    <Shell mode="public">
      <div className="space-y-6">
        <div>
          <Link href="/" className="text-sm text-ink-500 hover:text-brand-600 dark:text-ink-400">
            ← К дашборду
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight">{data.managerName}</h1>
            {data.source === 'mock' && (
              <span className="chip bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/25">
                демонстрационные данные
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">
            Заявки на размещение, кампании и бюджеты
          </p>
        </div>

        {data.source === 'mock' && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
            Раздел работает на демонстрационных данных. Структура повторяет реальную заявку на
            размещение, поэтому при подключении корпоративной базы поменяется только источник —
            экраны останутся прежними.
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatCard label="Активных кампаний" value={num(data.kpi.activeCampaigns)} accent="green" />
          <StatCard label="Заявок в работе" value={num(data.kpi.zayavkiInProgress)} accent="brand" />
          <StatCard label="Клубов в работе" value={num(data.kpi.clubsInWork)} />
          <StatCard label="Бюджет" value={money.format(data.kpi.budgetMonth)} hint="по согласованным" />
          <StatCard
            label="Ждут макета"
            value={num(data.kpi.waitingForMacet)}
            accent={data.kpi.waitingForMacet ? 'amber' : 'grey'}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <section className="card overflow-hidden">
            <div className="border-b border-ink-200/70 px-4 py-3 dark:border-white/10">
              <h2 className="text-sm font-semibold">Заявки на размещение</h2>
            </div>
            <div className="scroll-thin overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse">
                <thead className="bg-ink-50/60 dark:bg-white/5">
                  <tr>
                    <th className="th">Клиент</th>
                    <th className="th">Сеть и формат</th>
                    <th className="th">Период</th>
                    <th className="th text-center">Клубов</th>
                    <th className="th text-right">Бюджет</th>
                    <th className="th">Статус</th>
                    <th className="th text-center">Макет</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-200/60 dark:divide-white/5">
                  {data.zayavki.map((z) => (
                    <tr key={z.id} className="hover:bg-ink-50/60 dark:hover:bg-white/5">
                      <td className="td font-medium">{z.client}</td>
                      <td className="td">
                        <div>{z.network}</div>
                        <div className="text-[11px] text-ink-400">{z.format}</div>
                      </td>
                      <td className="td whitespace-nowrap text-ink-500 dark:text-ink-400">{period(z)}</td>
                      <td className="td text-center tabular-nums">
                        {z.clubsCount}
                        <div className="text-[11px] text-ink-400">{num(z.surfacesCount)} пов.</div>
                      </td>
                      <td className="td whitespace-nowrap text-right tabular-nums font-medium">
                        {money.format(z.budget)}
                      </td>
                      <td className="td">
                        <span className={`chip ${STATUS_STYLE[z.status]}`}>{z.status}</span>
                      </td>
                      <td className="td text-center">
                        {z.macetAttached ? (
                          <span
                            className="inline-flex text-emerald-600 dark:text-emerald-400"
                            title={z.previewApproved ? 'Макет и превью согласованы' : 'Макет есть, превью не согласовано'}
                          >
                            {z.previewApproved ? <IconCheck /> : <IconDoc />}
                          </span>
                        ) : (
                          <span className="inline-flex text-amber-600 dark:text-amber-400" title="Макет не приложен">
                            <IconAlert />
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="space-y-4">
            <section className="card p-4">
              <h2 className="text-sm font-semibold">Бюджет по месяцам</h2>
              <div className="mt-4 space-y-2">
                {data.monthly.map((m) => (
                  <div key={m.month} className="flex items-center gap-2">
                    <span className="w-14 shrink-0 text-xs text-ink-500 dark:text-ink-400">
                      {monthShort(m.month)}
                    </span>
                    <div className="h-5 flex-1 overflow-hidden rounded bg-ink-100 dark:bg-white/10">
                      <div
                        className="h-full rounded bg-brand-500/85"
                        style={{ width: `${Math.round((m.budget / maxBudget) * 100)}%` }}
                      />
                    </div>
                    <span className="w-20 shrink-0 text-right text-xs tabular-nums text-ink-600 dark:text-ink-300">
                      {Math.round(m.budget / 1000)} т.р.
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="card p-4">
              <h2 className="text-sm font-semibold">Сети в ведении</h2>
              <ul className="mt-3 space-y-1.5">
                {data.networks.map((n) => (
                  <li key={n.name} className="flex items-center justify-between text-sm">
                    <span>{n.name}</span>
                    <span className="tabular-nums text-ink-500 dark:text-ink-400">{n.clubs}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/lockers"
                className="mt-4 inline-flex text-xs text-brand-600 hover:underline dark:text-brand-300"
              >
                Посмотреть занятость этих клубов →
              </Link>
            </section>
          </div>
        </div>
      </div>
    </Shell>
  );
}
