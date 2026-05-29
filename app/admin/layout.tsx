import type { ReactNode } from 'react';

import { AdminNav } from '@/components/webflow/admin-nav';
import { WebflowStyles } from '@/components/webflow/webflow-styles';

export default function AdminLayout({ children }: { children: ReactNode }) {
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
