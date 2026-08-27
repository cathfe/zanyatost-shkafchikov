import { redirect } from 'next/navigation';

/**
 * Ручные изменения переехали на рабочий экран занятости: администратор
 * правит данные прямо там, а не в отдельном разделе.
 */
export default async function AdminManageRedirect({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; surface?: string }>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  if (sp.month) qs.set('month', sp.month);
  if (sp.surface) qs.set('surface', sp.surface);
  redirect(`/lockers${qs.toString() ? `?${qs}` : ''}`);
}
