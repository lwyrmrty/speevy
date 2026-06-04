import type { Metadata } from 'next';

import { TagsManager } from '@/components/webflow/tags-manager';
import { requireAdmin } from '@/lib/auth/admin';
import { listTagsWithCounts } from '@/lib/lp-tags';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const metadata: Metadata = {
  title: 'Investor Tags | Speevy',
};

export default async function AdminTagsPage() {
  await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const tags = await listTagsWithCounts(supabase);

  return (
    <div className="pagecontainer">
      <div className="pagecontent">
        <div className="pagemain">
          <div>
            <div className="tableheader">
              <div className="pagetitle">Investor Tags</div>
            </div>
            <TagsManager tags={tags} />
          </div>
        </div>
      </div>
    </div>
  );
}
