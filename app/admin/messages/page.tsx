import type { Metadata } from 'next';

import { AdminMessagesWorkspace } from '@/components/webflow/admin-messages-workspace';
import { getMessagesFeed } from '@/lib/admin/messages-feed';
import {
  getMessagesInvestorFilterOptions,
  getMessagesOpportunityFilterOptions,
} from '@/lib/admin/messages-filter-options';
import { DEFAULT_PAGE_SIZE, parsePageParam } from '@/lib/pagination';

export const metadata: Metadata = {
  title: 'Messages | Speevy',
};

export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string | string[] }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const page = parsePageParam(resolvedSearchParams.page);

  const [opportunityOptions, investorOptions, feed] = await Promise.all([
    getMessagesOpportunityFilterOptions(),
    getMessagesInvestorFilterOptions(),
    getMessagesFeed({ page, pageSize: DEFAULT_PAGE_SIZE }),
  ]);

  return (
    <div className="pagecontainer">
      <AdminMessagesWorkspace
        messageRows={feed.rows}
        opportunityOptions={opportunityOptions}
        investorOptions={investorOptions}
        page={feed.page}
        totalCount={feed.totalCount}
        totalPages={feed.totalPages}
      />
    </div>
  );
}
