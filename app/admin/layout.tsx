import type { ReactNode } from 'react';

import { AdminNav } from '@/components/webflow/admin-nav';
import { WebflowStyles } from '@/components/webflow/webflow-styles';
import { requireAdmin } from '@/lib/auth/admin';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();

  return (
    <>
      <WebflowStyles />
      <div className="pagewrapper">
        <AdminNav />
        {children}
      </div>
    </>
  );
}
