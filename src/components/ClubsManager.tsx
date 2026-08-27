'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteClub, upsertClub } from '@/app/admin/actions';
import { type Club, type Manager } from '@/lib/types';
import { num } from '@/lib/format';
import { IconAlert, IconCheck, IconSearch } from './Icons';

export type ClubWithCapacity = Club;

const EMPTY = {
  id: undefined as string | undefined,
  name: '',
  network: '',
  city: '',
  address: '',
  managerId: '',
  hasLockers: true,
  isActive: true,
  note: '',
};

export function ClubsManager({
  clubs,
  managers,
  canManageClubs,
}: {
  clubs: ClubWithCapacity[];
  managers: Manager[];
  canManageClubs: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState('');
  const [network, setNetwork] = useState('all');
  const [manager, setManager] = useState('all');
  const [editing, setEditing] = useState<typeof EMPTY | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const notify = (ok: boolean, text: string) => {
    setToast({ ok, text });
    setTimeout(() => setToast(null), 3500);
  };

  const networks = useMemo(
    () => [...new Set(clubs.map((c) => c.network).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'ru')),
    [clubs],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clubs.filter((c) => {
      if (q && !`${c.name} ${c.city ?? ''} ${c.network ?? ''} ${c.address ?? ''}`.toLowerCase().includes(q)) return false;
      if (network !== 'all' && c.network !== network) return false;
      if (manager !== 'all' && c.manager_id !== manager) return false;
      return true;
    });
  }, [clubs, query, network, manager]);



  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Клубы</h1>
          <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">
            {num(clubs.length)} клубов · {networks.length} сетей
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canManageClubs && (
            <button onClick={() => setEditing({ ...EMPTY })} className="btn-primary">
              Добавить клуб
            </button>
          )}
        </div>
      </div>

      <div className="card flex flex-wrap gap-3 p-3">
        <div className="relative min-w-[240px] flex-1">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по названию, городу, адресу…"
            className="input pl-9"
          />
        </div>
        <select value={network} onChange={(e) => setNetwork(e.target.value)} className="input w-auto min-w-[180px]">
          <option value="all">Все сети</option>
          {networks.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <select value={manager} onChange={(e) => setManager(e.target.value)} className="input w-auto min-w-[190px]">
          <option value="all">Все менеджеры</option>
          {managers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse">
            <thead className="border-b border-ink-200/70 bg-ink-50/60 dark:border-white/10 dark:bg-white/5">
              <tr>
                <th className="th">Клуб</th>
                <th className="th">Сеть</th>
                <th className="th">Менеджер</th>
                <th className="th">Город</th>
                <th className="th">Адрес</th>
                <th className="th text-center">Шкафчики</th>
                <th className="th text-center">Статус</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-200/60 dark:divide-white/5">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-ink-50/60 dark:hover:bg-white/5">
                  <td className="td font-medium">{c.name}</td>
                  <td className="td text-ink-500 dark:text-ink-400">{c.network ?? '—'}</td>
                  <td className="td whitespace-nowrap text-ink-500 dark:text-ink-400">
                    {managers.find((m) => m.id === c.manager_id)?.name ?? '—'}
                  </td>
                  <td className="td text-ink-500 dark:text-ink-400">{c.city ?? '—'}</td>
                  <td className="td max-w-[260px] truncate text-ink-500 dark:text-ink-400" title={c.address ?? ''}>
                    {c.address ?? '—'}
                  </td>
                  <td className="td text-center">
                    {c.has_lockers ? (
                      <span className="text-emerald-600 dark:text-emerald-400">есть</span>
                    ) : (
                      <span className="text-ink-400">только экраны</span>
                    )}
                  </td>
                  <td className="td text-center">
                    <span
                      className={`chip ${
                        c.is_active
                          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25'
                          : 'bg-ink-100 text-ink-500 ring-ink-200 dark:bg-white/5 dark:text-ink-400 dark:ring-white/10'
                      }`}
                    >
                      {c.is_active ? 'активен' : 'скрыт'}
                    </span>
                  </td>
                  <td className="td whitespace-nowrap text-right">
                    <button
                      onClick={() =>
                        setEditing({
                          id: c.id,
                          name: c.name,
                          network: c.network ?? '',
                          city: c.city ?? '',
                          address: c.address ?? '',
                          managerId: c.manager_id ?? '',
                          hasLockers: c.has_lockers,
                          isActive: c.is_active,
                          note: c.note ?? '',
                        })
                      }
                      className="ml-1 rounded-md border border-ink-200 px-2 py-1 text-[11px] text-ink-600 hover:bg-ink-50 dark:border-white/10 dark:text-ink-300 dark:hover:bg-white/5"
                    >
                      изменить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-ink-500 dark:text-ink-400">Клубы не найдены</p>
        )}
      </div>

      {editing && (
        <ClubDialog
          value={editing}
          managers={managers}
          onClose={() => setEditing(null)}
          onDone={(ok, text) => {
            notify(ok, text);
            if (ok) {
              setEditing(null);
              router.refresh();
            }
          }}
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

function ClubDialog({
  value,
  managers,
  onClose,
  onDone,
}: {
  value: typeof EMPTY;
  managers: Manager[];
  onClose: () => void;
  onDone: (ok: boolean, text: string) => void;
}) {
  const [form, setForm] = useState(value);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = async () => {
    if (!form.name.trim()) return onDone(false, 'Название клуба обязательно');
    setBusy(true);
    const res = await upsertClub({
      id: form.id,
      name: form.name,
      network: form.network,
      city: form.city,
      address: form.address,
      managerId: form.managerId || null,
      hasLockers: form.hasLockers,
      isActive: form.isActive,
      note: form.note,
    });
    setBusy(false);
    onDone(res.ok, res.ok ? 'Клуб сохранён' : res.error);
  };

  const remove = async () => {
    if (!form.id) return;
    setBusy(true);
    const res = await deleteClub({ id: form.id, name: form.name });
    setBusy(false);
    onDone(res.ok, res.ok ? 'Клуб удалён' : res.error);
  };

  const field = (key: keyof typeof EMPTY, label: string, placeholder = '') => (
    <div>
      <label className="label" htmlFor={key}>
        {label}
      </label>
      <input
        id={key}
        value={String(form[key] ?? '')}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        placeholder={placeholder}
        className="input"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink-950/40 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-pop sm:rounded-2xl dark:bg-ink-900">
        <h2 className="mb-4 text-base font-semibold">{form.id ? 'Изменить клуб' : 'Новый клуб'}</h2>

        <div className="space-y-3">
          {field('name', 'Название', 'Alex Fitness ГУМ')}
          {field('network', 'Сеть', 'Alex Fitness')}
          {field('city', 'Город', 'Казань')}
          {field('address', 'Адрес', 'ул. Пушкина, д. 1')}
          <div>
            <label className="label" htmlFor="managerId">
              Менеджер
            </label>
            <select
              id="managerId"
              value={form.managerId}
              onChange={(e) => setForm({ ...form, managerId: e.target.value })}
              className="input"
            >
              <option value="">не назначен</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {field('note', 'Примечание')}

          <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.hasLockers}
              onChange={(e) => setForm({ ...form, hasLockers: e.target.checked })}
              className="h-4 w-4 rounded border-ink-300 text-brand-600"
            />
            Есть шкафчики (у сетей вроде DDX только экраны)
          </label>

          <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="h-4 w-4 rounded border-ink-300 text-brand-600"
            />
            Показывать в разделе занятости
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button onClick={save} disabled={busy} className="btn-primary flex-1">
            {busy ? 'Сохраняем…' : 'Сохранить'}
          </button>
          {form.id && !confirmDelete && (
            <button onClick={() => setConfirmDelete(true)} disabled={busy} className="btn-danger">
              Удалить
            </button>
          )}
          {form.id && confirmDelete && (
            <button onClick={remove} disabled={busy} className="btn-danger">
              Точно удалить?
            </button>
          )}
          <button onClick={onClose} disabled={busy} className="btn-ghost">
            Отмена
          </button>
        </div>

        {confirmDelete && (
          <p className="mt-3 text-xs text-rose-600 dark:text-rose-400">
            Вместе с клубом удалятся его вместимость, занятость и ручные правки.
          </p>
        )}
      </div>
    </div>
  );
}
