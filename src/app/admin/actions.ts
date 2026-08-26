'use server';

import { revalidatePath } from 'next/cache';
import { createClient, getSession } from '@/lib/supabase/server';
import type { CellStatus, Gender, Role, SurfaceType } from '@/lib/types';

async function requireAdmin() {
  const session = await getSession();
  if (!session.user || !session.isAdmin) {
    throw new Error('Нужны права администратора.');
  }
  return session;
}

/** Правки занятости и импорт доступны редакторам и администраторам. */
async function requireEditor() {
  const session = await getSession();
  if (!session.user || !session.canEdit) {
    throw new Error('Недостаточно прав: нужна роль «Редактор» или «Администратор».');
  }
  return session;
}

async function log(entry: {
  club_id?: string | null;
  club_name?: string | null;
  month?: string | null;
  slot?: number | null;
  gender?: Gender | null;
  action: string;
  details?: Record<string, unknown>;
}) {
  const session = await getSession();
  const supabase = await createClient();
  await supabase.from('lockers_admin_log').insert({
    club_id: entry.club_id ?? null,
    club_name: entry.club_name ?? null,
    month: entry.month ?? null,
    slot: entry.slot ?? null,
    gender: entry.gender ?? null,
    action: entry.action,
    details: entry.details ?? {},
    actor_id: session.user?.id ?? null,
    actor_email: session.user?.email ?? null,
  });
}

export type ActionResult = { ok: true } | { ok: false; error: string };

/* ------------------------------------------------------------------ */
/* Занятость                                                           */
/* ------------------------------------------------------------------ */

export async function saveOverride(input: {
  clubId: string;
  clubName: string;
  month: string;
  slot: 1 | 2;
  gender: Gender;
  surface: SurfaceType;
  status: CellStatus | null;
  totalOverride: number | null;
  occupiedOverride: number | null;
  reserved: number;
  note: string | null;
}): Promise<ActionResult> {
  try {
    const session = await requireEditor();
    const supabase = await createClient();

    const { error } = await supabase.from('lockers_overrides').upsert(
      {
        club_id: input.clubId,
        month: input.month,
        slot: input.slot,
        gender: input.gender,
        surface_type: input.surface,
        status: input.status,
        total_override: input.totalOverride,
        occupied_override: input.occupiedOverride,
        reserved: input.reserved,
        note: input.note,
        updated_by: session.user!.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'club_id,month,slot,gender,surface_type' },
    );

    if (error) return { ok: false, error: error.message };

    await log({
      club_id: input.clubId,
      club_name: input.clubName,
      month: input.month,
      slot: input.slot,
      gender: input.gender,
      action: 'override_saved',
      details: {
        surface: input.surface,
        status: input.status,
        total: input.totalOverride,
        occupied: input.occupiedOverride,
        reserved: input.reserved,
        note: input.note,
      },
    });

    revalidatePath('/admin/manage');
    revalidatePath('/lockers');
    revalidatePath('/overlaps');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Неизвестная ошибка' };
  }
}

/** Снять ручную правку — вернуть значение из импорта. */
export async function clearOverride(input: {
  clubId: string;
  clubName: string;
  month: string;
  slot: 1 | 2;
  gender: Gender;
  surface: SurfaceType;
}): Promise<ActionResult> {
  try {
    await requireEditor();
    const supabase = await createClient();

    const { error } = await supabase
      .from('lockers_overrides')
      .delete()
      .match({
        club_id: input.clubId,
        month: input.month,
        slot: input.slot,
        gender: input.gender,
        surface_type: input.surface,
      });

    if (error) return { ok: false, error: error.message };

    await log({
      club_id: input.clubId,
      club_name: input.clubName,
      month: input.month,
      slot: input.slot,
      gender: input.gender,
      action: 'override_cleared',
      details: { surface: input.surface },
    });

    revalidatePath('/admin/manage');
    revalidatePath('/lockers');
    revalidatePath('/overlaps');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Неизвестная ошибка' };
  }
}

/** Массовое действие: закрыть/открыть слот или раздевалку целиком. */
export async function bulkSetStatus(input: {
  clubId: string;
  clubName: string;
  month: string;
  surface: SurfaceType;
  slots: (1 | 2)[];
  genders: Gender[];
  status: CellStatus | null;
  reserved?: number;
  note?: string | null;
}): Promise<ActionResult> {
  try {
    const session = await requireEditor();
    const supabase = await createClient();

    const rows = input.slots.flatMap((slot) =>
      input.genders.map((gender) => ({
        club_id: input.clubId,
        month: input.month,
        slot,
        gender,
        surface_type: input.surface,
        status: input.status,
        reserved: input.reserved ?? 0,
        note: input.note ?? null,
        updated_by: session.user!.id,
        updated_at: new Date().toISOString(),
      })),
    );

    const { error } = await supabase
      .from('lockers_overrides')
      .upsert(rows, { onConflict: 'club_id,month,slot,gender,surface_type' });

    if (error) return { ok: false, error: error.message };

    await log({
      club_id: input.clubId,
      club_name: input.clubName,
      month: input.month,
      action: 'bulk_status',
      details: {
        surface: input.surface,
        slots: input.slots,
        genders: input.genders,
        status: input.status,
        reserved: input.reserved ?? 0,
        note: input.note ?? null,
      },
    });

    revalidatePath('/admin/manage');
    revalidatePath('/lockers');
    revalidatePath('/overlaps');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Неизвестная ошибка' };
  }
}

/* ------------------------------------------------------------------ */
/* Вместимость                                                         */
/* ------------------------------------------------------------------ */

export async function setCapacity(input: {
  clubId: string;
  clubName: string;
  surface: SurfaceType;
  male: number;
  female: number;
}): Promise<ActionResult> {
  try {
    await requireEditor();
    const supabase = await createClient();

    const { error } = await supabase.from('lockers_capacity').upsert(
      [
        {
          club_id: input.clubId,
          gender: 'male',
          surface_type: input.surface,
          total_lockers: input.male,
          updated_at: new Date().toISOString(),
        },
        {
          club_id: input.clubId,
          gender: 'female',
          surface_type: input.surface,
          total_lockers: input.female,
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: 'club_id,gender,surface_type' },
    );

    if (error) return { ok: false, error: error.message };

    await log({
      club_id: input.clubId,
      club_name: input.clubName,
      action: 'capacity_set',
      details: { surface: input.surface, male: input.male, female: input.female },
    });

    revalidatePath('/admin/clubs');
    revalidatePath('/lockers');
    revalidatePath('/overlaps');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Неизвестная ошибка' };
  }
}

/* ------------------------------------------------------------------ */
/* Клубы                                                               */
/* ------------------------------------------------------------------ */

export async function upsertClub(input: {
  id?: string;
  name: string;
  network: string | null;
  city: string | null;
  address: string | null;
  managerId: string | null;
  isActive: boolean;
  note: string | null;
}): Promise<ActionResult> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    const payload = {
      name: input.name.trim(),
      network: input.network?.trim() || null,
      city: input.city?.trim() || null,
      address: input.address?.trim() || null,
      manager_id: input.managerId || null,
      is_active: input.isActive,
      note: input.note?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (input.id) {
      const { error } = await supabase.from('lockers_clubs').update(payload).eq('id', input.id);
      if (error) return { ok: false, error: error.message };
      await log({ club_id: input.id, club_name: payload.name, action: 'club_updated', details: payload });
    } else {
      const { data, error } = await supabase
        .from('lockers_clubs')
        .insert({ ...payload, source: 'manual' })
        .select('id')
        .single();
      if (error) return { ok: false, error: error.message };
      await log({ club_id: data.id, club_name: payload.name, action: 'club_created', details: payload });
    }

    revalidatePath('/admin/clubs');
        revalidatePath('/lockers');
    revalidatePath('/overlaps');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Неизвестная ошибка' };
  }
}

export async function deleteClub(input: { id: string; name: string }): Promise<ActionResult> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    const { error } = await supabase.from('lockers_clubs').delete().eq('id', input.id);
    if (error) return { ok: false, error: error.message };

    await log({ club_id: null, club_name: input.name, action: 'club_deleted', details: { id: input.id } });

    revalidatePath('/admin/clubs');
        revalidatePath('/lockers');
    revalidatePath('/overlaps');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Неизвестная ошибка' };
  }
}


/* ------------------------------------------------------------------ */
/* Менеджеры                                                           */
/* ------------------------------------------------------------------ */

export async function upsertManager(input: {
  id?: string;
  name: string;
  slug: string;
  isActive: boolean;
}): Promise<ActionResult> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    const payload = {
      name: input.name.trim(),
      slug: input.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      is_active: input.isActive,
    };

    if (!payload.name || !payload.slug) {
      return { ok: false, error: 'Имя и слаг обязательны' };
    }

    const { error } = input.id
      ? await supabase.from('lockers_managers').update(payload).eq('id', input.id)
      : await supabase.from('lockers_managers').insert(payload);

    if (error) return { ok: false, error: error.message };

    await log({ action: input.id ? 'manager_updated' : 'manager_created', details: payload });

    revalidatePath('/admin/settings');
    revalidatePath('/');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Неизвестная ошибка' };
  }
}

/* ------------------------------------------------------------------ */
/* Пользователи и доступы                                              */
/* ------------------------------------------------------------------ */

/**
 * Выдать или изменить доступ. Пользователь должен быть заранее создан
 * в Supabase Auth — здесь мы находим его по почте и назначаем роль.
 * Количество пользователей не ограничено.
 */
export async function grantAccess(input: {
  email: string;
  role: Role;
  fullName: string | null;
  managerId: string | null;
}): Promise<ActionResult> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    const { data: found, error: lookupError } = await supabase.rpc('lockers_find_user_by_email', {
      p_email: input.email.trim().toLowerCase(),
    });

    if (lookupError) return { ok: false, error: lookupError.message };
    if (!found) {
      return {
        ok: false,
        error: 'Пользователь с такой почтой не найден в Supabase Auth. Сначала создайте его там.',
      };
    }

    const { error } = await supabase.from('lockers_admins').upsert(
      {
        user_id: found as string,
        email: input.email.trim().toLowerCase(),
        full_name: input.fullName?.trim() || null,
        role: input.role,
        manager_id: input.managerId || null,
        is_active: true,
      },
      { onConflict: 'user_id' },
    );

    if (error) return { ok: false, error: error.message };

    await log({
      action: 'access_granted',
      details: { email: input.email, role: input.role, manager_id: input.managerId },
    });

    revalidatePath('/admin/settings');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Неизвестная ошибка' };
  }
}

export async function updateAccess(input: {
  userId: string;
  role: Role;
  managerId: string | null;
  isActive: boolean;
}): Promise<ActionResult> {
  try {
    const session = await requireAdmin();

    if (session.user!.id === input.userId && (input.role !== 'admin' || !input.isActive)) {
      return { ok: false, error: 'Нельзя снять администратора с самого себя — попросите другого админа.' };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from('lockers_admins')
      .update({ role: input.role, manager_id: input.managerId || null, is_active: input.isActive })
      .eq('user_id', input.userId);

    if (error) return { ok: false, error: error.message };

    await log({ action: 'access_updated', details: { user_id: input.userId, role: input.role } });

    revalidatePath('/admin/settings');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Неизвестная ошибка' };
  }
}

export async function revokeAccess(input: { userId: string; email: string | null }): Promise<ActionResult> {
  try {
    const session = await requireAdmin();
    if (session.user!.id === input.userId) {
      return { ok: false, error: 'Нельзя отозвать доступ у самого себя.' };
    }

    const supabase = await createClient();
    const { error } = await supabase.from('lockers_admins').delete().eq('user_id', input.userId);
    if (error) return { ok: false, error: error.message };

    await log({ action: 'access_revoked', details: { email: input.email } });

    revalidatePath('/admin/settings');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Неизвестная ошибка' };
  }
}
