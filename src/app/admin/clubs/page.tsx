import { ClubsManager } from '@/components/ClubsManager';
import { createClient, getSession } from '@/lib/supabase/server';
import type { Club, Manager } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Справочник клубов. В меню не выводится — нужен для служебных правок:
 * привязка менеджера, признак «есть шкафчики», скрытие клуба.
 */
export default async function AdminClubsPage() {
  const supabase = await createClient();

  const [{ data: clubs }, { data: managers }, session] = await Promise.all([
    supabase.from('lockers_clubs').select('*').order('name'),
    supabase.from('lockers_managers').select('*').order('name'),
    getSession(),
  ]);

  return (
    <ClubsManager
      clubs={(clubs ?? []) as Club[]}
      managers={(managers ?? []) as Manager[]}
      canManageClubs={session.isAdmin}
    />
  );
}
