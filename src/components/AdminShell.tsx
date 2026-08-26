'use client';

import { useRouter } from 'next/navigation';
import { Shell } from './Shell';
import { createClient } from '@/lib/supabase/client';
import { ROLE_LABEL, type Role } from '@/lib/types';

export function AdminShell({
  children,
  userEmail,
  role,
}: {
  children: React.ReactNode;
  userEmail: string | null;
  role: Role;
}) {
  const router = useRouter();

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/admin/login');
    router.refresh();
  };

  return (
    <Shell mode="admin" userEmail={`${userEmail ?? ''} · ${ROLE_LABEL[role]}`} onSignOut={signOut}>
      {children}
    </Shell>
  );
}
