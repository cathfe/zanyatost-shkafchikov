import { createClient } from '@/lib/supabase/server';
import { groupMirrors, groupSlots, type CampaignRef, type Manager, type MirrorRow, type SlotRow } from '@/lib/types';

/** Общая загрузка данных для экранов шкафчиков и зеркал. */
export async function loadBoard(month: string, surface: 'lockers' | 'mirrors') {
  const supabase = await createClient();

  const [board, managersRes, campaignsRes] = await Promise.all([
    surface === 'lockers'
      ? supabase.rpc('lockers_slots', { p_month: month })
      : supabase.rpc('lockers_mirrors', { p_month: month }),
    supabase.from('lockers_managers').select('*').eq('is_active', true).order('name'),
    supabase
      .from('lockers_campaigns')
      .select('id, client, label, manager_id, period_start, period_end')
      .order('label'),
  ]);

  const clubs =
    surface === 'lockers'
      ? groupSlots((board.data ?? []) as SlotRow[])
      : groupMirrors((board.data ?? []) as MirrorRow[]);

  return {
    error: board.error,
    clubs,
    managers: (managersRes.data ?? []) as Manager[],
    campaigns: (campaignsRes.data ?? []) as CampaignRef[],
  };
}
