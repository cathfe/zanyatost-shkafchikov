import { ImportTabs } from '@/components/ImportTabs';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function AdminImportPage() {
  const supabase = await createClient();
  const { count } = await supabase
    .from('lockers_clubs')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);

  return <ImportTabs currentCount={count ?? 0} />;
}
