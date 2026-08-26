import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

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

/** Текущий пользователь + признак администратора. */
export async function getSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, isAdmin: false, role: null as string | null };

  const { data } = await supabase
    .from('lockers_admins')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  return { user, isAdmin: Boolean(data), role: data?.role ?? null };
}
