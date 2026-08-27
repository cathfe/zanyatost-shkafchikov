'use server';

import { revalidatePath } from 'next/cache';
import { createClient, getSession } from '@/lib/supabase/server';
import type { Gender, Role, Slot, SlotStatus, SurfaceType } from '@/lib/types';

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAdmin() {
  const session = await getSession();
  if (!session.user || !session.isAdmin) throw new Error('Нужны права администратора.');
  return session;
}

/** Правки статусов и размещений доступны редакторам и администраторам. */
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

function refreshWorkScreens() {
  revalidatePath('/lockers');
  revalidatePath('/mirrors');
  revalidatePath('/overlaps');
  revalidatePath('/');
}

/* ------------------------------------------------------------------ */
/* Статусы слотов и зеркал                                             */
/* ------------------------------------------------------------------ */

export type SlotInput = {
  clubId: string;
  clubName: string;
  month: string;
  surface: SurfaceType;
  gender: Gender;
  /** null для зеркал — там слотов нет */
  slot: Slot | null;
  status: SlotStatus;
  campaignId: string | null;
  campaignLabel: string | null;
  reason: string | null;
};

export async function setSlotStatus(input: SlotInput): Promise<ActionResult> {
  try {
    const session = await requireEditor();
    const supabase = await createClient();

    if (input.surface === 'mirrors' && input.slot !== null) {
      return { ok: false, error: 'У зеркал нет слотов' };
    }
    if (input.surface === 'lockers' && input.slot === null) {
      return { ok: false, error: 'Для шкафчиков нужно указать слот' };
    }

    // Свободный слот не храним — просто убираем запись
    if (input.status === 'free') {
      const { error } = await supabase
        .from('lockers_slot_status')
        .delete()
        .match({
          club_id: input.clubId,
          month: input.month,
          surface_type: input.surface,
          gender: input.gender,
          ...(input.slot === null ? {} : { slot: input.slot }),
        });
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await supabase.from('lockers_slot_status').upsert(
        {
          club_id: input.clubId,
          month: input.month,
          surface_type: input.surface,
          gender: input.gender,
          slot: input.slot,
          status: input.status,
          campaign_id: input.campaignId,
          campaign_label: input.campaignLabel,
          reason: input.reason,
          source: 'manual',
          updated_by: session.user!.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'club_id,month,surface_type,gender,slot' },
      );
      if (error) return { ok: false, error: error.message };
    }

    await log({
      club_id: input.clubId,
      club_name: input.clubName,
      month: input.month,
      slot: input.slot,
      gender: input.gender,
      action: 'slot_status',
      details: {
        surface: input.surface,
        status: input.status,
        campaign: input.campaignLabel,
        reason: input.reason,
      },
    });

    refreshWorkScreens();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Неизвестная ошибка' };
  }
}

/** Массово: занять или закрыть слот целиком, раздевалку в обоих слотах и т.п. */
export async function bulkSetSlots(input: {
  clubId: string;
  clubName: string;
  month: string;
  surface: SurfaceType;
  slots: (Slot | null)[];
  genders: Gender[];
  status: SlotStatus;
  campaignId: string | null;
  campaignLabel: string | null;
  reason: string | null;
}): Promise<ActionResult> {
  try {
    const session = await requireEditor();
    const supabase = await createClient();

    const combos = input.slots.flatMap((slot) => input.genders.map((gender) => ({ slot, gender })));

    if (input.status === 'free') {
      for (const c of combos) {
        await supabase
          .from('lockers_slot_status')
          .delete()
          .match({
            club_id: input.clubId,
            month: input.month,
            surface_type: input.surface,
            gender: c.gender,
            ...(c.slot === null ? {} : { slot: c.slot }),
          });
      }
    } else {
      const rows = combos.map((c) => ({
        club_id: input.clubId,
        month: input.month,
        surface_type: input.surface,
        gender: c.gender,
        slot: c.slot,
        status: input.status,
        campaign_id: input.campaignId,
        campaign_label: input.campaignLabel,
        reason: input.reason,
        source: 'manual',
        updated_by: session.user!.id,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase
        .from('lockers_slot_status')
        .upsert(rows, { onConflict: 'club_id,month,surface_type,gender,slot' });
      if (error) return { ok: false, error: error.message };
    }

    await log({
      club_id: input.clubId,
      club_name: input.clubName,
      month: input.month,
      action: 'slot_bulk',
      details: {
        surface: input.surface,
        slots: input.slots,
        genders: input.genders,
        status: input.status,
        campaign: input.campaignLabel,
      },
    });

    refreshWorkScreens();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Неизвестная ошибка' };
  }
}

/* ------------------------------------------------------------------ */
/* Размещения в дашборде менеджера                                     */
/* ------------------------------------------------------------------ */

export async function updatePlacement(input: {
  id: string;
  clubName: string;
  patch: Partial<{
    status: 'not_sent' | 'waiting' | 'approved' | 'declined';
    status_detail: string | null;
    visit_type: 'сам' | 'монтажник' | 'бтл';
    assignee: string | null;
    photo_status: 'expected' | 'received' | 'overdue';
    tasks_done: boolean;
    note: string | null;
  }>;
}): Promise<ActionResult> {
  try {
    const session = await requireEditor();
    const supabase = await createClient();

    const { error } = await supabase
      .from('lockers_placements')
      .update({ ...input.patch, updated_by: session.user!.id, updated_at: new Date().toISOString() })
      .eq('id', input.id);

    if (error) return { ok: false, error: error.message };

    await log({
      club_name: input.clubName,
      action: 'placement_updated',
      details: { id: input.id, ...input.patch },
    });

    revalidatePath('/managers', 'layout');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Неизвестная ошибка' };
  }
}

/* ------------------------------------------------------------------ */
/* Клубы, менеджеры, доступы                                           */
/* ------------------------------------------------------------------ */

export async function upsertClub(input: {
  id?: string;
  name: string;
  network: string | null;
  city: string | null;
  address: string | null;
  managerId: string | null;
  hasLockers: boolean;
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
      has_lockers: input.hasLockers,
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
    refreshWorkScreens();
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
    await log({ club_name: input.name, action: 'club_deleted', details: { id: input.id } });
    revalidatePath('/admin/clubs');
    refreshWorkScreens();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Неизвестная ошибка' };
  }
}

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
    if (!payload.name || !payload.slug) return { ok: false, error: 'Имя и слаг обязательны' };

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

    await log({ action: 'access_granted', details: { email: input.email, role: input.role } });
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
