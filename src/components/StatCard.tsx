export function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: 'green' | 'red' | 'amber' | 'brand' | 'grey';
}) {
  const accentClass =
    accent === 'green'
      ? 'text-emerald-600 dark:text-emerald-400'
      : accent === 'red'
        ? 'text-rose-600 dark:text-rose-400'
        : accent === 'amber'
          ? 'text-amber-600 dark:text-amber-400'
          : accent === 'brand'
            ? 'text-brand-600 dark:text-brand-300'
            : 'text-ink-900 dark:text-ink-100';

  return (
    <div className="card px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${accentClass}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{hint}</div>}
    </div>
  );
}
