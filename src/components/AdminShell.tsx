'use client';

import { Shell } from './Shell';
import type { Role } from '@/lib/types';

export function AdminShell({
  children,
  userEmail,
  role,
}: {
  children: React.ReactNode;
  userEmail: string | null;
  role: Role;
}) {
  return (
    <Shell mode="admin" userEmail={userEmail} role={role}>
      {children}
    </Shell>
  );
}
