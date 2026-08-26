'use client';

import { useState } from 'react';
import { ClubsImport } from './ClubsImport';
import { ImportWizard } from './ImportWizard';

type Tab = 'clubs' | 'ap';

export function ImportTabs({ currentCount }: { currentCount: number }) {
  const [tab, setTab] = useState<Tab>('clubs');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Импорт данных</h1>
        <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">
          Справочник клубов задаёт, какие клубы вообще есть в системе. Адресная программа
          наполняет их вместимостью и занятостью.
        </p>
      </div>

      <div className="flex gap-1 rounded-lg border border-ink-200 bg-white p-1 dark:border-white/10 dark:bg-ink-900 sm:w-fit">
        {(
          [
            { key: 'clubs' as Tab, label: 'Клубы и менеджеры' },
            { key: 'ap' as Tab, label: 'Адресная программа' },
          ]
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors sm:flex-none ${
              tab === t.key
                ? 'bg-ink-900 text-white dark:bg-white dark:text-ink-900'
                : 'text-ink-600 hover:bg-ink-50 dark:text-ink-300 dark:hover:bg-white/5'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'clubs' ? <ClubsImport currentCount={currentCount} /> : <ImportWizard />}
    </div>
  );
}
