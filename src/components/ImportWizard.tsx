'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { GENDER_LABEL, SURFACE_LABEL, type Gender, type SurfaceType } from '@/lib/types';
import { monthLabel, num } from '@/lib/format';
import { IconAlert, IconCheck, IconUpload } from './Icons';

type PreviewRow = {
  clubName: string;
  matched: boolean;
  city: string | null;
  surfaceType: SurfaceType;
  slot: number;
  gender: Gender | null;
  total: number | null;
  statusRaw: string | null;
  occupiedMonths: string[];
  issues: string[];
};

type ParseResponse = {
  importId: string;
  fileName: string;
  campaignLabel: string | null;
  warnings: string[];
  stats: {
    rows: number;
    sheets: number;
    clubs: number;
    newClubs: number;
    months: string[];
    occupiedRows: number;
    issues: number;
    protectedOverrides: number;
  };
  newClubNames: string[];
  sheets: { name: string; surfaceType: SurfaceType; headerRow: number; headerMap: Record<string, string>; rowCount: number }[];
  preview: PreviewRow[];
};

type ApplyResult = {
  createdClubs: number;
  enrichedClubs: number;
  capacityRows: number;
  occupancyRows: number;
  freedRows: number;
  months: string[];
};

export function ImportWizard() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [parsed, setParsed] = useState<ParseResponse | null>(null);
  const [applied, setApplied] = useState<ApplyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createMissing, setCreateMissing] = useState(true);
  const [updateCapacity, setUpdateCapacity] = useState(true);
  const [showAllIssues, setShowAllIssues] = useState(false);

  const reset = () => {
    setFile(null);
    setParsed(null);
    setApplied(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const upload = async (f: File) => {
    setParsing(true);
    setError(null);
    setParsed(null);
    setApplied(null);

    const fd = new FormData();
    fd.append('file', f);

    try {
      const res = await fetch('/api/import/parse', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Не удалось разобрать файл');
      setParsed(json as ParseResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
    } finally {
      setParsing(false);
    }
  };

  const apply = async () => {
    if (!parsed) return;
    setApplying(true);
    setError(null);
    try {
      const res = await fetch('/api/import/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          importId: parsed.importId,
          createMissingClubs: createMissing,
          updateCapacity,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Не удалось применить импорт');
      setApplied(json as ApplyResult);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
    } finally {
      setApplying(false);
    }
  };

  const issueRows = parsed?.preview.filter((r) => r.issues.length > 0) ?? [];

  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-500 dark:text-ink-400">
        Файл читается по названиям колонок, поэтому переживает их перестановку между АП.
        Ручные правки администратора импорт не перезаписывает.
      </p>

      {/* Шаг 1 — файл */}
      <div className="card p-5">
        <label
          htmlFor="ap-file"
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink-200 px-6 py-10 text-center transition-colors hover:border-brand-400 hover:bg-brand-50/40 dark:border-white/15 dark:hover:border-brand-500/50 dark:hover:bg-brand-500/5"
        >
          <IconUpload className="h-7 w-7 text-ink-400" />
          <span className="text-sm font-medium">
            {file ? file.name : 'Выберите файл адресной программы (.xlsx)'}
          </span>
          <span className="text-xs text-ink-500 dark:text-ink-400">
            Читаются листы со стикерами в шкафах и на зеркалах в раздевалках
          </span>
          <input
            ref={inputRef}
            id="ap-file"
            type="file"
            accept=".xlsx,.xlsm"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setFile(f);
                void upload(f);
              }
            }}
          />
        </label>

        {parsing && (
          <p className="mt-3 text-center text-sm text-ink-500 dark:text-ink-400">Разбираем файл…</p>
        )}

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            <IconAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
      </div>

      {/* Шаг 2 — предпросмотр */}
      {parsed && !applied && (
        <>
          <div className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Что нашли в файле</h2>
                <p className="text-xs text-ink-500 dark:text-ink-400">
                  {parsed.fileName}
                  {parsed.campaignLabel ? ` · клиент: ${parsed.campaignLabel}` : ''}
                </p>
              </div>
              <button onClick={reset} className="btn-ghost">
                Выбрать другой файл
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Metric label="Строк" value={num(parsed.stats.rows)} />
              <Metric label="Клубов" value={num(parsed.stats.clubs)} />
              <Metric label="Новых клубов" value={num(parsed.stats.newClubs)} tone={parsed.stats.newClubs ? 'brand' : undefined} />
              <Metric label="Занятых строк" value={num(parsed.stats.occupiedRows)} tone="red" />
              <Metric label="Проблем" value={num(parsed.stats.issues)} tone={parsed.stats.issues ? 'amber' : undefined} />
              <Metric
                label="Правок защищено"
                value={num(parsed.stats.protectedOverrides)}
                tone={parsed.stats.protectedOverrides ? 'green' : undefined}
              />
            </div>

            {parsed.stats.months.length > 0 && (
              <div className="mt-4">
                <span className="label">Месяцы в файле</span>
                <div className="flex flex-wrap gap-1.5">
                  {parsed.stats.months.map((m) => (
                    <span
                      key={m}
                      className="chip bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-500/25"
                    >
                      {monthLabel(m)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4">
              <span className="label">Распознанные листы и колонки</span>
              <div className="space-y-2">
                {parsed.sheets.map((s) => (
                  <div key={s.name} className="rounded-lg border border-ink-200/70 p-3 text-xs dark:border-white/10">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <span className="font-medium">{s.name}</span>
                      <span className="chip bg-ink-100 text-ink-600 ring-ink-200 dark:bg-white/5 dark:text-ink-300 dark:ring-white/10">
                        {SURFACE_LABEL[s.surfaceType]}
                      </span>
                      <span className="text-ink-400">
                        заголовки в строке {s.headerRow} · {s.rowCount} строк
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-ink-500 dark:text-ink-400">
                      {Object.entries(s.headerMap).map(([field, header]) => (
                        <span key={field}>
                          <span className="text-ink-400">{field}</span> → {header}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {parsed.warnings.length > 0 && (
              <div className="mt-4 space-y-1.5">
                {parsed.warnings.map((w, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200"
                  >
                    <IconAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    {w}
                  </div>
                ))}
              </div>
            )}
          </div>

          {parsed.newClubNames.length > 0 && (
            <div className="card p-5">
              <h2 className="text-sm font-semibold">
                Новые клубы ({parsed.newClubNames.length})
              </h2>
              <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">
                Этих клубов ещё нет в каталоге — при применении они будут созданы.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {parsed.newClubNames.map((n) => (
                  <span
                    key={n}
                    className="chip bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25"
                  >
                    {n}
                  </span>
                ))}
              </div>
            </div>
          )}

          {issueRows.length > 0 && (
            <div className="card p-5">
              <h2 className="text-sm font-semibold">Строки, которые нужно проверить</h2>
              <ul className="mt-3 space-y-1.5 text-sm">
                {(showAllIssues ? issueRows : issueRows.slice(0, 8)).map((r, i) => (
                  <li key={i} className="rounded-lg bg-amber-50/70 px-3 py-2 dark:bg-amber-500/10">
                    <span className="font-medium">{r.clubName}</span>
                    <span className="text-ink-500 dark:text-ink-400">
                      {' '}
                      · слот {r.slot}
                      {r.gender ? ` · ${GENDER_LABEL[r.gender]}` : ''}
                    </span>
                    <div className="text-xs text-amber-800 dark:text-amber-200">{r.issues.join('; ')}</div>
                  </li>
                ))}
              </ul>
              {issueRows.length > 8 && (
                <button
                  onClick={() => setShowAllIssues((v) => !v)}
                  className="mt-2 text-xs text-brand-600 hover:underline dark:text-brand-300"
                >
                  {showAllIssues ? 'Свернуть' : `Показать все (${issueRows.length})`}
                </button>
              )}
            </div>
          )}

          <div className="card overflow-hidden">
            <div className="border-b border-ink-200/70 px-4 py-3 dark:border-white/10">
              <h2 className="text-sm font-semibold">Предпросмотр строк</h2>
              <p className="text-xs text-ink-500 dark:text-ink-400">
                Первые {Math.min(parsed.preview.length, 200)} из {parsed.stats.rows}
              </p>
            </div>
            <div className="scroll-thin max-h-[420px] overflow-auto">
              <table className="w-full min-w-[780px] border-collapse text-sm">
                <thead className="sticky top-0 bg-ink-50/95 dark:bg-ink-900/95">
                  <tr>
                    <th className="th">Клуб</th>
                    <th className="th">Поверхность</th>
                    <th className="th text-center">Слот</th>
                    <th className="th">Раздевалка</th>
                    <th className="th text-center">Шкафчиков</th>
                    <th className="th">Статус в файле</th>
                    <th className="th">Занято в месяцах</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-200/60 dark:divide-white/5">
                  {parsed.preview.map((r, i) => (
                    <tr key={i} className={r.issues.length ? 'bg-amber-50/50 dark:bg-amber-500/5' : ''}>
                      <td className="td">
                        {r.clubName}
                        {!r.matched && (
                          <span className="ml-1.5 chip bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25">
                            новый
                          </span>
                        )}
                      </td>
                      <td className="td text-ink-500 dark:text-ink-400">{SURFACE_LABEL[r.surfaceType]}</td>
                      <td className="td text-center">{r.slot}</td>
                      <td className="td text-ink-500 dark:text-ink-400">
                        {r.gender ? GENDER_LABEL[r.gender] : '—'}
                      </td>
                      <td className="td text-center tabular-nums">{r.total ?? '—'}</td>
                      <td className="td max-w-[220px] truncate text-ink-500 dark:text-ink-400" title={r.statusRaw ?? ''}>
                        {r.statusRaw ?? '—'}
                      </td>
                      <td className="td">
                        {r.occupiedMonths.length === 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400">свободно</span>
                        ) : (
                          <span className="text-rose-600 dark:text-rose-400">
                            {r.occupiedMonths.map((m) => monthLabel(m)).join(', ')}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card space-y-3 p-5">
            <h2 className="text-sm font-semibold">Применить импорт</h2>

            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={createMissing}
                onChange={(e) => setCreateMissing(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-ink-300 text-brand-600"
              />
              <span>
                Создавать клубы, которых нет в каталоге
                <span className="block text-xs text-ink-500 dark:text-ink-400">
                  Найдено новых: {parsed.stats.newClubs}
                </span>
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={updateCapacity}
                onChange={(e) => setUpdateCapacity(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-ink-300 text-brand-600"
              />
              <span>
                Обновлять вместимость раздевалок из колонки «Количество»
                <span className="block text-xs text-ink-500 dark:text-ink-400">
                  Снимите галочку, если вместимость в этой АП неполная
                </span>
              </span>
            </label>

            {parsed.stats.protectedOverrides > 0 && (
              <div className="flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
                <IconCheck className="mt-0.5 h-4 w-4 shrink-0" />
                {parsed.stats.protectedOverrides} ручных правок в этих месяцах останутся нетронутыми —
                при конфликте приоритет у администратора.
              </div>
            )}

            <button onClick={apply} disabled={applying} className="btn-primary w-full sm:w-auto">
              {applying ? 'Применяем…' : 'Применить к базе'}
            </button>
          </div>
        </>
      )}

      {/* Шаг 3 — результат */}
      {applied && (
        <div className="card p-5">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <IconCheck className="h-5 w-5" />
            <h2 className="text-sm font-semibold">Импорт применён</h2>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Metric label="Создано клубов" value={num(applied.createdClubs)} />
            <Metric label="Дополнено клубов" value={num(applied.enrichedClubs)} />
            <Metric label="Вместимость" value={num(applied.capacityRows)} />
            <Metric label="Занятость" value={num(applied.occupancyRows)} tone="red" />
            <Metric label="Освобождено" value={num(applied.freedRows)} tone="green" />
          </div>

          <div className="mt-4 flex gap-2">
            <button onClick={reset} className="btn-ghost">
              Загрузить ещё одну АП
            </button>
            <a href="/admin/manage" className="btn-primary">
              Открыть занятость
            </a>
          </div>
        </div>
      )}
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
  tone?: 'green' | 'red' | 'amber' | 'brand';
}) {
  const cls =
    tone === 'green'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'red'
        ? 'text-rose-600 dark:text-rose-400'
        : tone === 'amber'
          ? 'text-amber-600 dark:text-amber-400'
          : tone === 'brand'
            ? 'text-brand-600 dark:text-brand-300'
            : '';

  return (
    <div className="rounded-lg border border-ink-200/70 px-3 py-2 dark:border-white/10">
      <div className="text-[11px] uppercase tracking-wide text-ink-500 dark:text-ink-400">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}
