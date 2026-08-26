import { mockSource } from './mock';
import type { ManagerDashboardSource } from './types';

/**
 * Точка переключения источника данных дашборда менеджера.
 *
 * Пока это mock. Когда корпоративная база будет согласована — реализуйте
 * `supabaseSource` с тем же интерфейсом `ManagerDashboardSource`, положите
 * рядом в `./supabase.ts` и поменяйте только эту строку. Страницы и компоненты
 * трогать не нужно: они работают с типом `ManagerDashboard`, а не с источником.
 *
 * Переключатель вынесен в переменную окружения, чтобы можно было включить
 * боевые данные без правок кода:
 *   MANAGER_DASHBOARD_SOURCE=supabase
 */
const SOURCES: Record<string, ManagerDashboardSource> = {
  mock: mockSource,
  // supabase: supabaseSource,
};

export function managerDashboardSource(): ManagerDashboardSource {
  const key = process.env.MANAGER_DASHBOARD_SOURCE ?? 'mock';
  return SOURCES[key] ?? mockSource;
}

export * from './types';
