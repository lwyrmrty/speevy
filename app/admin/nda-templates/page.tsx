import type { Metadata } from 'next';

import { listNdaTemplates } from '@/app/admin/nda-templates/actions';
import { NdaTemplatesManager } from '@/components/webflow/nda-templates-manager';
import { requireAdmin } from '@/lib/auth/admin';

export const metadata: Metadata = {
  title: 'NDA Templates | Speevy',
};

export default async function AdminNdaTemplatesPage() {
  await requireAdmin();
  const templates = await listNdaTemplates();

  return (
    <div className="pagecontainer">
      <div className="pagecontent">
        <div className="pagemain">
          <div>
            <div className="tableheader">
              <div className="pagetitle">NDA Templates</div>
            </div>
            <NdaTemplatesManager templates={templates} />
          </div>
        </div>
      </div>
    </div>
  );
}
