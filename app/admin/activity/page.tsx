import { Suspense } from 'react';

import { AdminActivityWorkspace } from '@/components/webflow/admin-activity-workspace';
import { getActivityFeed } from '@/lib/admin/activity-feed';
import {
  getActivityInvestorFilterOptions,
  getActivityOpportunityFilterOptions,
} from '@/lib/admin/activity-filter-options';
import { DEFAULT_PAGE_SIZE, parsePageParam } from '@/lib/pagination';

export default async function AdminActivityPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string | string[] }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const page = parsePageParam(resolvedSearchParams.page);

  const [opportunityOptions, investorOptions, feed] = await Promise.all([
    getActivityOpportunityFilterOptions(),
    getActivityInvestorFilterOptions(),
    getActivityFeed({ page, pageSize: DEFAULT_PAGE_SIZE }),
  ]);

  return (
    <div className="pagecontainer">
      <AdminActivityWorkspace
        activityRows={feed.rows}
        opportunityOptions={opportunityOptions}
        investorOptions={investorOptions}
        page={feed.page}
        totalCount={feed.totalCount}
        totalPages={feed.totalPages}
      />
    </div>
  );
}
