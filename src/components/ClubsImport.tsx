'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { num } from '@/lib/format';
import { IconAlert, IconCheck, IconUpload } from './Icons';

type Summary = {
  ok: boolean;
  dryRun: boolean;
  fileName: string;
  totalRows: number;
  uniqueClubs: number;
  expectedCount: number | null;
  duplicates: { name: string; count: number; rows: number[] }[];
  skippedRows: number[];
  missingManager: string[];
  managers: { name: string; clubs: number }[];
  hasNetworkColumn: boolean;
  newClubs: string[];
  missingFromFile: string[];
  errors: string[];
  created?: number;
  updated?: number;
  deactivated?: number;
  createdManagers?: number;
  activeClubs?: number;
  matchesExpected?: boolean;
};

export function ClubsImport({ currentCount }: { currentCount: number }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [expected, setExpected] = useState('318');
  const [deactivateMissing, setDeactivateMissing] = useState(true);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [applied, setApplied] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async (f: File, dryRun: boolean) => {
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.append('file', f);
    fd.append('dryRun', String(dryRun));
    fd.append('expectedCount', expected.trim());
    fd.append('deactivateMissing', String(deactivateMissing));

    try {
      const res = await fetch('/api/import/clubs', { method: 'POST', body: fd });
      const json = (await res.json()) as Summary & { error?: string };
      if (json.error) throw new Error(json.error);
      if (dryRun) setSummary(json);
      else if (json.ok) {
        setApplied(json);
        setSummary(json);
        router.refresh();
      } else {
        setSummary(json);
        setError('Импорт остановлен: проверки не пройдены.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setFile(null);
    setSummary(null);
    setApplied(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const blocked = Boolean(summary && summary.errors.length > 0);

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Справочник клубов и менеджеров</h2>
            <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">
              Файл — единственный источник клубов: колонка 1 — название клуба, колонка 2 —
              менеджер, колонка 3 (необязательно) — сеть. Сейчас в системе {num(currentCount)} активных клубов.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <div>
            <label className="label" htmlFor="expected">
              Контрольное количество клубов
            </label>
            <input
              id="expected"
              value={expected}
              onChange={(e) => setExpected(e.target.value)}
              inputMode="numeric"
              className="input"
              placeholder="318"
            />
            <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
              Если после разбора уникальных клубов окажется другое число — импорт остановится.
              Оставьте поле пустым, чтобы не проверять.
            </p>
          </div>
          <label className="flex items-start gap-2 self-end pb-1 text-sm">
            <input
              type="checkbox"
              checked={deactivateMissing}
              onChange={(e) => setDeactivateMissing(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-ink-300 text-brand-600"
            />
            <span>
              Скрывать клубы, которых нет в файле
              <span className="block text-xs text-ink-500 dark:text-ink-400">
                Не удаляем, а помечаем неактивными
              </span>
            </span>
          </label>
        </div>

        <label
          htmlFor="clubs-file"
          className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink-200 px-6 py-8 text-center transition-colors hover:border-brand-400 hover:bg-brand-50/40 dark:border-white/15 dark:hover:border-brand-500/50 dark:hover:bg-brand-500/5"
        >
          <IconUpload className="h-6 w-6 text-ink-400" />
          <span className="text-sm font-medium">{file ? file.name : 'Выберите файл (.xlsx)'}</span>
          <span className="text-xs text-ink-500 dark:text-ink-400">
            Сначала разбор и проверки, запись — отдельной кнопкой
          </span>
          <input
            ref={inputRef}
            id="clubs-file"
            type="file"
            accept=".xlsx,.xlsm"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setFile(f);
                setApplied(null);
                void send(f, true);
              }
            }}
          />
        </label>

        {busy && <p className="mt-3 text-center text-sm text-ink-500">Обрабатываем…</p>}

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            <IconAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
      </div>

      {summary && (
        <>
          <div className="card p-5">
            <h3 className="text-sm font-semibold">Результат проверки</h3>

            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="Строк в файле" value={num(summary.totalRows)} />
              <Metric
                label="Уникальных клубов"
                value={num(summary.uniqueClubs)}
                tone={
                  summary.expectedCount == null
                    ? undefined
                    : summary.uniqueClubs === summary.expectedCount
                      ? 'green'
                      : 'red'
                }
              />
              <Metric
                label="Дубликатов"
                value={num(summary.duplicates.length)}
                tone={summary.duplicates.length ? 'red' : 'green'}
              />
              <Metric
                label="Потерянных строк"
                value={num(summary.skippedRows.length)}
                tone={summary.skippedRows.length ? 'red' : 'green'}
              />
            </div>

            {summary.errors.length > 0 ? (
              <div className="mt-4 space-y-2">
                {summary.errors.map((e, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-500/10 dark:text-rose-200"
                  >
                    <IconAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    {e}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
                <IconCheck className="mt-0.5 h-4 w-4 shrink-0" />
                Проверки пройдены: дубликатов нет, потерянных строк нет
                {summary.expectedCount != null && `, количество совпадает с контрольным (${summary.expectedCount})`}.
              </div>
            )}

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <span className="label">Менеджеры в файле</span>
                <ul className="space-y-1 text-sm">
                  {summary.managers.map((m) => (
                    <li key={m.name} className="flex justify-between">
                      <span>{m.name}</span>
                      <span className="tabular-nums text-ink-500 dark:text-ink-400">{m.clubs}</span>
                    </li>
                  ))}
                  {summary.missingManager.length > 0 && (
                    <li className="flex justify-between text-amber-700 dark:text-amber-300">
                      <span>без менеджера</span>
                      <span className="tabular-nums">{summary.missingManager.length}</span>
                    </li>
                  )}
                </ul>
              </div>

              <div className="space-y-3">
                <ListBlock title="Новых клубов" items={summary.newClubs} tone="green" />
                <ListBlock
                  title={deactivateMissing ? 'Будут скрыты (нет в файле)' : 'Нет в файле'}
                  items={summary.missingFromFile}
                  tone="amber"
                />
              </div>
            </div>
          </div>

          {!applied && (
            <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
              <div className="text-sm">
                {blocked ? (
                  <span className="text-rose-700 dark:text-rose-300">
                    Импорт заблокирован — сначала исправьте файл.
                  </span>
                ) : (
                  <span className="text-ink-600 dark:text-ink-300">
                    Проверки пройдены, можно записывать в базу.
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={reset} className="btn-ghost">
                  Другой файл
                </button>
                <button
                  onClick={() => file && send(file, false)}
                  disabled={busy || blocked || !file}
                  className="btn-primary"
                >
                  {busy ? 'Записываем…' : 'Импортировать'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {applied && (
        <div className="card p-5">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <IconCheck className="h-5 w-5" />
            <h3 className="text-sm font-semibold">Импорт выполнен</h3>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Metric label="Создано клубов" value={num(applied.created ?? 0)} tone="green" />
            <Metric label="Обновлено" value={num(applied.updated ?? 0)} />
            <Metric label="Скрыто" value={num(applied.deactivated ?? 0)} tone="amber" />
            <Metric label="Новых менеджеров" value={num(applied.createdManagers ?? 0)} />
            <Metric
              label="Активных клубов"
              value={num(applied.activeClubs ?? 0)}
              tone={applied.matchesExpected ? 'green' : 'red'}
            />
          </div>

          <p className="mt-3 text-sm">
            {applied.matchesExpected ? (
              <span className="text-emerald-700 dark:text-emerald-300">
                В системе {num(applied.activeClubs ?? 0)} активных клубов — совпадает с контрольным числом.
              </span>
            ) : (
              <span className="text-rose-700 dark:text-rose-300">
                Внимание: активных клубов {num(applied.activeClubs ?? 0)}, а ожидалось{' '}
                {applied.expectedCount}. Проверьте раздел «Клубы».
              </span>
            )}
          </p>

          <button onClick={reset} className="btn-ghost mt-4">
            Загрузить другой файл
          </button>
        </div>
      )}
    </div>
  );
}

function ListBlock({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: 'green' | 'amber';
}) {
  if (!items.length) return null;
  const cls =
    tone === 'green'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25'
      : 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/25';

  return (
    <div>
      <span className="label">
        {title} · {items.length}
      </span>
      <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
        {items.slice(0, 60).map((n) => (
          <span key={n} className={`chip ${cls}`}>
            {n}
          </span>
        ))}
        {items.length > 60 && (
          <span className="text-xs text-ink-500 dark:text-ink-400">и ещё {items.length - 60}</span>
        )}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'green' | 'red' | 'amber';
}) {
  const cls =
    tone === 'green'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'red'
        ? 'text-rose-600 dark:text-rose-400'
        : tone === 'amber'
          ? 'text-amber-600 dark:text-amber-400'
          : '';
  return (
    <div className="rounded-lg border border-ink-200/70 px-3 py-2 dark:border-white/10">
      <div className="text-[11px] uppercase tracking-wide text-ink-500 dark:text-ink-400">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}
