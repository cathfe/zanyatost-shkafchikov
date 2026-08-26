import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Role } from '@/lib/types';

/** Клиент для серверных компонентов и route handlers (сессия из cookie). */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Вызов из серверного компонента — куки обновит middleware.
          }
        },
      },
    },
  );
}

/**
 * Текущий пользователь и его роль.
 *
 * Роли: admin — всё, включая пользователей и клубы; editor — правки занятости
 * и импорт; viewer — только просмотр внутренних разделов.
 */
export async function getSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, role: null as Role | null, managerId: null, isAdmin: false, canEdit: false };
  }

  const { data } = await supabase
    .from('lockers_admins')
    .select('role, manager_id, is_active')
    .eq('user_id', user.id)
    .maybeSingle();

  const active = data?.is_active !== false;
  const role = (active ? (data?.role as Role | undefined) : undefined) ?? null;

  return {
    user,
    role,
    managerId: data?.manager_id ?? null,
    isAdmin: role === 'admin',
    canEdit: role === 'admin' || role === 'editor',
  };
}
