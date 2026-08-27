'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { grantAccess, revokeAccess, updateAccess, upsertManager } from '@/app/admin/actions';
import { ROLE_HINT, ROLE_LABEL, type AppUser, type Manager, type Role } from '@/lib/types';
import { formatDateTime } from '@/lib/format';
import { IconAlert, IconCheck } from './Icons';

const ROLES: Role[] = ['admin', 'editor', 'viewer'];

export function SettingsManager({
  users,
  managers,
  currentUserId,
}: {
  users: AppUser[];
  managers: Manager[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<Role>('viewer');
  const [managerId, setManagerId] = useState('');

  const [newManager, setNewManager] = useState('');

  const notify = (ok: boolean, text: string) => {
    setToast({ ok, text });
    setTimeout(() => setToast(null), 4000);
  };

  const submitGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await grantAccess({ email, role, fullName: fullName || null, managerId: managerId || null });
    setBusy(false);
    notify(res.ok, res.ok ? 'Доступ выдан' : res.error);
    if (res.ok) {
      setEmail('');
      setFullName('');
      setManagerId('');
      router.refresh();
    }
  };

  const change = async (u: AppUser, patch: Partial<{ role: Role; managerId: string | null; isActive: boolean }>) => {
    setBusy(true);
    const res = await updateAccess({
      userId: u.user_id,
      role: patch.role ?? u.role,
      managerId: patch.managerId !== undefined ? patch.managerId : u.manager_id,
      isActive: patch.isActive ?? u.is_active,
    });
    setBusy(false);
    notify(res.ok, res.ok ? 'Сохранено' : res.error);
    if (res.ok) router.refresh();
  };

  const revoke = async (u: AppUser) => {
    setBusy(true);
    const res = await revokeAccess({ userId: u.user_id, email: u.email });
    setBusy(false);
    notify(res.ok, res.ok ? 'Доступ отозван' : res.error);
    if (res.ok) router.refresh();
  };

  const addManager = async (e: React.FormEvent) => {
    e.preventDefault();
    const slug = translit(newManager);
    setBusy(true);
    const res = await upsertManager({ name: newManager, slug, isActive: true });
    setBusy(false);
    notify(res.ok, res.ok ? 'Менеджер добавлен' : res.error);
    if (res.ok) {
      setNewManager('');
      router.refresh();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Настройки</h1>
        <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">
          Пользователи, роли и менеджеры. Количество пользователей не ограничено.
        </p>
      </div>

      <section className="card p-5">
        <h2 className="text-sm font-semibold">Выдать доступ</h2>
        <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">
          Сначала создайте пользователя в Supabase → Authentication → Users (с галочкой Auto Confirm),
          затем выдайте ему роль здесь по той же почте.
        </p>

        <form onSubmit={submitGrant} className="mt-4 grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="почта@company.ru"
            className="input"
          />
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Имя (необязательно)"
            className="input"
          />
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="input">
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
          <select value={managerId} onChange={(e) => setManagerId(e.target.value)} className="input">
            <option value="">Без привязки к менеджеру</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <button type="submit" disabled={busy} className="btn-primary">
            Выдать
          </button>
        </form>

        <ul className="mt-4 grid gap-1.5 text-xs text-ink-500 sm:grid-cols-3 dark:text-ink-400">
          {ROLES.map((r) => (
            <li key={r} className="rounded-lg bg-ink-50 px-3 py-2 dark:bg-white/5">
              <span className="font-medium text-ink-700 dark:text-ink-200">{ROLE_LABEL[r]}</span>
              <span className="mt-0.5 block">{ROLE_HINT[r]}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-ink-200/70 px-4 py-3 dark:border-white/10">
          <h2 className="text-sm font-semibold">Пользователи · {users.length}</h2>
        </div>
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse">
            <thead className="bg-ink-50/60 dark:bg-white/5">
              <tr>
                <th className="th">Пользователь</th>
                <th className="th">Роль</th>
                <th className="th">Менеджер</th>
                <th className="th text-center">Активен</th>
                <th className="th">Добавлен</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-200/60 dark:divide-white/5">
              {users.map((u) => (
                <tr key={u.user_id} className="hover:bg-ink-50/60 dark:hover:bg-white/5">
                  <td className="td">
                    <div className="font-medium">{u.full_name ?? u.email ?? '—'}</div>
                    {u.full_name && <div className="text-[11px] text-ink-400">{u.email}</div>}
                    {u.user_id === currentUserId && (
                      <span className="chip mt-1 bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-500/25">
                        это вы
                      </span>
                    )}
                  </td>
                  <td className="td">
                    <select
                      value={u.role}
                      disabled={busy}
                      onChange={(e) => change(u, { role: e.target.value as Role })}
                      className="input py-1.5 text-xs"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="td">
                    <select
                      value={u.manager_id ?? ''}
                      disabled={busy}
                      onChange={(e) => change(u, { managerId: e.target.value || null })}
                      className="input py-1.5 text-xs"
                    >
                      <option value="">—</option>
                      {managers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="td text-center">
                    <input
                      type="checkbox"
                      checked={u.is_active}
                      disabled={busy || u.user_id === currentUserId}
                      onChange={(e) => change(u, { isActive: e.target.checked })}
                      className="h-4 w-4 rounded border-ink-300 text-brand-600"
                    />
                  </td>
                  <td className="td whitespace-nowrap text-xs text-ink-500 dark:text-ink-400">
                    {formatDateTime(u.created_at)}
                  </td>
                  <td className="td text-right">
                    {u.user_id !== currentUserId && (
                      <button
                        onClick={() => revoke(u)}
                        disabled={busy}
                        className="rounded-md border border-rose-200 px-2 py-1 text-[11px] text-rose-700 hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
                      >
                        отозвать
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-semibold">Менеджеры · {managers.length}</h2>
        <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">
          К менеджерам привязываются клубы. Их дашборды доступны с главной страницы.
        </p>

        <ul className="mt-4 divide-y divide-ink-200/60 dark:divide-white/5">
          {managers.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div>
                <div className="font-medium">{m.name}</div>
                <div className="text-[11px] text-ink-400">/managers/{m.slug}</div>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-ink-500 dark:text-ink-400">
                <input
                  type="checkbox"
                  checked={m.is_active}
                  disabled={busy}
                  onChange={async (e) => {
                    setBusy(true);
                    const res = await upsertManager({
                      id: m.id,
                      name: m.name,
                      slug: m.slug,
                      isActive: e.target.checked,
                    });
                    setBusy(false);
                    notify(res.ok, res.ok ? 'Сохранено' : res.error);
                    if (res.ok) router.refresh();
                  }}
                  className="h-4 w-4 rounded border-ink-300 text-brand-600"
                />
                активен
              </label>
            </li>
          ))}
        </ul>

        <form onSubmit={addManager} className="mt-4 flex flex-wrap gap-2">
          <input
            value={newManager}
            onChange={(e) => setNewManager(e.target.value)}
            placeholder="Имя нового менеджера"
            className="input flex-1 min-w-[220px]"
            required
          />
          <button type="submit" disabled={busy} className="btn-ghost">
            Добавить
          </button>
        </form>
      </section>

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

const MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

function translit(value: string): string {
  return value
    .toLowerCase()
    .split('')
    .map((ch) => MAP[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
