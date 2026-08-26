import Link from 'next/link';
import { Shell } from '@/components/Shell';
import { createClient } from '@/lib/supabase/server';
import { currentMonthIso, num } from '@/lib/format';
import type { Club } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ClubsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; network?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const network = sp.network ?? '';

  const supabase = await createClient();

  let query = supabase
    .from('lockers_clubs')
    .select('id, name, network, city, address, is_active')
    .eq('is_active', true)
    .order('name');

  if (q) query = query.ilike('name', `%${q}%`);
  if (network) query = query.eq('network', network);

  const [{ data: clubs }, { data: allForNetworks }] = await Promise.all([
    query,
    supabase.from('lockers_clubs').select('network').eq('is_active', true),
  ]);

  const networks = [
    ...new Set(((allForNetworks ?? []) as { network: string | null }[]).map((c) => c.network).filter(Boolean) as string[]),
  ].sort((a, b) => a.localeCompare(b, 'ru'));

  const list = (clubs ?? []) as Pick<Club, 'id' | 'name' | 'network' | 'city' | 'address' | 'is_active'>[];
  const month = currentMonthIso();

  const grouped = new Map<string, typeof list>();
  for (const c of list) {
    const key = c.network ?? 'Прочие';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(c);
  }

  return (
    <Shell mode="public">
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Клубы</h1>
            <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">
              {num(list.length)} клубов · {grouped.size} сетей
            </p>
          </div>
        </div>

        <form className="card flex flex-wrap gap-3 p-3" action="/clubs">
          <input
            name="q"
            defaultValue={q}
            placeholder="Поиск по названию клуба…"
            className="input flex-1 min-w-[220px]"
          />
          <select name="network" defaultValue={network} className="input w-auto min-w-[180px]">
            <option value="">Все сети</option>
            {networks.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-primary">
            Найти
          </button>
        </form>

        <div className="space-y-4">
          {[...grouped.entries()]
            .sort((a, b) => a[0].localeCompare(b[0], 'ru'))
            .map(([net, items]) => (
              <section key={net} className="card overflow-hidden">
                <div className="flex items-center justify-between border-b border-ink-200/70 px-4 py-2.5 dark:border-white/10">
                  <h2 className="text-sm font-semibold">{net}</h2>
                  <span className="text-xs text-ink-500 dark:text-ink-400">{items.length} клубов</span>
                </div>
                <ul className="divide-y divide-ink-200/60 dark:divide-white/5">
                  {items.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/club/${c.id}?month=${month}`}
                        className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-ink-50/70 dark:hover:bg-white/5"
                      >
                        <span className="font-medium">{c.name}</span>
                        <span className="truncate text-xs text-ink-500 dark:text-ink-400">
                          {[c.city, c.address].filter(Boolean).join(' · ') || '—'}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
        </div>
      </div>
    </Shell>
  );
}
