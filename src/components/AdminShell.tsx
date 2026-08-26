'use client';

import { useRouter } from 'next/navigation';
import { Shell } from './Shell';
import { createClient } from '@/lib/supabase/client';

export function AdminShell({
  children,
  userEmail,
}: {
  children: React.ReactNode;
  userEmail: string | null;
}) {
  const router = useRouter();

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/admin/login');
    router.refresh();
  };

  return (
    <Shell mode="admin" userEmail={userEmail} onSignOut={signOut}>
      {children}
    </Shell>
  );
}
