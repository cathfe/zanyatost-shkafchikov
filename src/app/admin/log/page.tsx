import { createClient } from '@/lib/supabase/server';
import { formatDateTime, monthLabel } from '@/lib/format';
import { GENDER_LABEL, type AdminLogEntry } from '@/lib/types';

export const dynamic = 'force-dynamic';

const ACTION_LABEL: Record<string, string> = {
  override_saved: 'Ручная правка занятости',
  override_cleared: 'Правка снята',
  bulk_status: 'Массовое изменение статуса',
  capacity_set: 'Изменена вместимость',
  club_created: 'Добавлен клуб',
  club_updated: 'Изменён клуб',
  club_deleted: 'Удалён клуб',
  import_applied: 'Применён импорт АП',
};

const ACTION_TONE: Record<string, string> = {
  override_saved: 'bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-500/25',
  override_cleared: 'bg-ink-100 text-ink-600 ring-ink-200 dark:bg-white/5 dark:text-ink-300 dark:ring-white/10',
  bulk_status: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/25',
  capacity_set: 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-200 dark:ring-violet-500/25',
  club_deleted: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/25',
  import_applied: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25',
};

export default async function AdminLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const perPage = 50;

  const supabase = await createClient();
  const { data, count } = await supabase
    .from('lockers_admin_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

  const entries = (data ?? []) as AdminLogEntry[];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / perPage));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Журнал изменений</h1>
        <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">
          Все ручные действия и применённые импорты · всего {count ?? 0}
        </p>
      </div>

      <div className="card overflow-hidden">
        {entries.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-ink-500 dark:text-ink-400">
            Записей пока нет
          </p>
        ) : (
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse">
              <thead className="border-b border-ink-200/70 bg-ink-50/60 dark:border-white/10 dark:bg-white/5">
                <tr>
                  <th className="th">Когда</th>
                  <th className="th">Действие</th>
                  <th className="th">Объект</th>
                  <th className="th">Детали</th>
                  <th className="th">Кто</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-200/60 dark:divide-white/5">
                {entries.map((e) => (
                  <tr key={e.id} className="hover:bg-ink-50/60 dark:hover:bg-white/5">
                    <td className="td whitespace-nowrap text-ink-500 dark:text-ink-400">
                      {formatDateTime(e.created_at)}
                    </td>
                    <td className="td">
                      <span className={`chip ${ACTION_TONE[e.action] ?? 'bg-ink-100 text-ink-600 ring-ink-200 dark:bg-white/5 dark:text-ink-300 dark:ring-white/10'}`}>
                        {ACTION_LABEL[e.action] ?? e.action}
                      </span>
                    </td>
                    <td className="td">
                      <div className="font-medium">{e.club_name ?? '—'}</div>
                      <div className="text-xs text-ink-500 dark:text-ink-400">
                        {[
                          e.month ? monthLabel(e.month) : null,
                          e.slot ? `слот ${e.slot}` : null,
                          e.gender ? GENDER_LABEL[e.gender] : null,
                        ]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </div>
                    </td>
                    <td className="td max-w-[320px]">
                      <code className="block truncate font-mono text-xs text-ink-500 dark:text-ink-400">
                        {JSON.stringify(e.details)}
                      </code>
                    </td>
                    <td className="td whitespace-nowrap text-ink-500 dark:text-ink-400">
                      {e.actor_email ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <a href={`/admin/log?page=${page - 1}`} className="btn-ghost">
              Назад
            </a>
          )}
          <span className="text-sm text-ink-500 dark:text-ink-400">
            Страница {page} из {totalPages}
          </span>
          {page < totalPages && (
            <a href={`/admin/log?page=${page + 1}`} className="btn-ghost">
              Вперёд
            </a>
          )}
        </div>
      )}
    </div>
  );
}
