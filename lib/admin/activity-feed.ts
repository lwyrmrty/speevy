import { createLpProfilePictureSignedUrl } from '@/lib/lp-profile-picture';
import {
  buildPaginatedResult,
  clampPage,
  DEFAULT_PAGE_SIZE,
  getPaginationOffset,
  getTotalPages,
  type PaginatedResult,
} from '@/lib/pagination';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export type ActivityFeedType = 'viewed' | 'interest' | 'joined' | 'approved' | 'signed';

export type ActivityFeedRow = {
  id: string;
  type: ActivityFeedType;
  occurredAt: string;
  investorId: string | null;
  investorName: string;
  investorPhotoUrl: string | null;
  opportunityId: string | null;
  opportunityTitle: string | null;
  opportunitySlug: string | null;
  ndaLabel: string | null;
};

const FEED_ACTIONS = [
  'opportunity.viewed',
  'interest.indicated',
  'lp.joined',
  'lp.approved',
  'nda.signed',
] as const;

const ACTION_TO_TYPE: Record<(typeof FEED_ACTIONS)[number], ActivityFeedType> = {
  'opportunity.viewed': 'viewed',
  'interest.indicated': 'interest',
  'lp.joined': 'joined',
  'lp.approved': 'approved',
  'nda.signed': 'signed',
};

type AuditRow = {
  id: string;
  action: (typeof FEED_ACTIONS)[number];
  actor_profile_id: string | null;
  entity_type: string;
  entity_id: string | null;
  metadata: unknown;
  created_at: string;
};

type LpRow = {
  id: string;
  profile_id: string | null;
  full_name: string | null;
  email: string;
  profile_picture_storage_key: string | null;
};

type OpportunityRow = {
  id: string;
  slug: string;
  title: string;
};

type AccountNdaRow = {
  id: string;
  lp_id: string;
  envelope_id: string;
  nda_template_id: string;
};

type OpportunityNdaRow = {
  id: string;
  lp_id: string;
  opportunity_id: string;
  envelope_id: string;
};

type NdaTemplateRow = {
  id: string;
  name: string;
};

function uniqueIds(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function readMetadata(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readString(metadata: Record<string, unknown> | null, key: string) {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

export function formatActivityRelativeTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));

  if (seconds < 60) {
    return 'just now';
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hr ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  }).format(date);
}

export async function getActivityFeed(options: {
  page?: number;
  pageSize?: number;
} = {}): Promise<PaginatedResult<ActivityFeedRow>> {
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const requestedPage = options.page ?? 1;
  const supabase = createSupabaseAdminClient();

  const { count } = await supabase
    .from('audit_log')
    .select('id', { count: 'exact', head: true })
    .in('action', [...FEED_ACTIONS]);

  const totalCount = count ?? 0;
  const totalPages = getTotalPages(totalCount, pageSize);
  const page = clampPage(requestedPage, totalPages);
  const offset = getPaginationOffset(page, pageSize);

  if (totalCount === 0) {
    return buildPaginatedResult([], 0, page, pageSize);
  }

  const { data: auditData } = await supabase
    .from('audit_log')
    .select('id, action, actor_profile_id, entity_type, entity_id, metadata, created_at')
    .in('action', [...FEED_ACTIONS])
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  const auditRows = (auditData ?? []) as AuditRow[];
  if (!auditRows.length) {
    return buildPaginatedResult([], totalCount, page, pageSize);
  }

  const profileIds = uniqueIds(auditRows.map((row) => row.actor_profile_id));
  const metadataLpIds = auditRows.map((row) =>
    readString(readMetadata(row.metadata), 'lp_id'),
  );
  const entityLpIds = auditRows
    .filter((row) => row.entity_type === 'lp')
    .map((row) => row.entity_id);
  const lpIds = uniqueIds([...metadataLpIds, ...entityLpIds]);
  const opportunityIds = auditRows
    .filter((row) => row.entity_type === 'opportunity')
    .map((row) => row.entity_id);
  const opportunityNdaIds = auditRows
    .filter((row) => row.entity_type === 'opportunity_nda')
    .map((row) => row.entity_id);
  const accountNdaIds = auditRows
    .filter((row) => row.entity_type === 'account_nda')
    .map((row) => row.entity_id);
  const envelopeIds = auditRows
    .map((row) => readString(readMetadata(row.metadata), 'envelope_id'));

  const [
    { data: lpsByProfileData },
    { data: lpsByIdData },
    { data: opportunitiesData },
    { data: opportunityNdasData },
    { data: accountNdasByIdData },
    { data: accountNdasByEnvelopeData },
  ] = await Promise.all([
    profileIds.length
      ? supabase
        .from('lps')
        .select('id, profile_id, full_name, email, profile_picture_storage_key')
        .in('profile_id', profileIds)
      : Promise.resolve({ data: [] }),
    lpIds.length
      ? supabase
        .from('lps')
        .select('id, profile_id, full_name, email, profile_picture_storage_key')
        .in('id', lpIds)
        .neq('status', 'removed')
      : Promise.resolve({ data: [] }),
    opportunityIds.length
      ? supabase
        .from('opportunities')
        .select('id, slug, title')
        .in('id', uniqueIds(opportunityIds))
      : Promise.resolve({ data: [] }),
    opportunityNdaIds.length
      ? supabase
        .from('opportunity_ndas')
        .select('id, lp_id, opportunity_id, envelope_id')
        .in('id', uniqueIds(opportunityNdaIds))
      : Promise.resolve({ data: [] }),
    accountNdaIds.length
      ? supabase
        .from('account_ndas')
        .select('id, lp_id, envelope_id, nda_template_id')
        .in('id', uniqueIds(accountNdaIds))
      : Promise.resolve({ data: [] }),
    envelopeIds.length
      ? supabase
        .from('account_ndas')
        .select('id, lp_id, envelope_id, nda_template_id')
        .in('envelope_id', uniqueIds(envelopeIds))
      : Promise.resolve({ data: [] }),
  ]);

  const opportunityNdas = (opportunityNdasData ?? []) as OpportunityNdaRow[];
  const accountNdas = [
    ...((accountNdasByIdData ?? []) as AccountNdaRow[]),
    ...((accountNdasByEnvelopeData ?? []) as AccountNdaRow[]),
  ];

  const extraOpportunityIds = uniqueIds(opportunityNdas.map((row) => row.opportunity_id));
  const { data: extraOpportunitiesData } = extraOpportunityIds.length
    ? await supabase
      .from('opportunities')
      .select('id, slug, title')
      .in('id', extraOpportunityIds)
    : { data: [] };

  const extraLpIds = uniqueIds([
    ...opportunityNdas.map((row) => row.lp_id),
    ...accountNdas.map((row) => row.lp_id),
  ]);

  const { data: extraLpsData } = extraLpIds.length
    ? await supabase
      .from('lps')
      .select('id, profile_id, full_name, email, profile_picture_storage_key')
      .in('id', extraLpIds)
      .neq('status', 'removed')
    : { data: [] };

  const templateIds = uniqueIds(accountNdas.map((row) => row.nda_template_id));
  const { data: templatesData } = templateIds.length
    ? await supabase
      .from('nda_templates')
      .select('id, name')
      .in('id', templateIds)
    : { data: [] };

  const lps = [
    ...((lpsByProfileData ?? []) as LpRow[]),
    ...((lpsByIdData ?? []) as LpRow[]),
    ...((extraLpsData ?? []) as LpRow[]),
  ];
  const opportunities = [
    ...((opportunitiesData ?? []) as OpportunityRow[]),
    ...((extraOpportunitiesData ?? []) as OpportunityRow[]),
  ];

  const lpById = new Map(lps.map((lp) => [lp.id, lp]));
  const lpByProfileId = new Map(
    lps
      .filter((lp): lp is LpRow & { profile_id: string } => Boolean(lp.profile_id))
      .map((lp) => [lp.profile_id, lp]),
  );
  const opportunityById = new Map(opportunities.map((opportunity) => [opportunity.id, opportunity]));
  const opportunityNdaById = new Map(opportunityNdas.map((row) => [row.id, row]));
  const accountNdaById = new Map(accountNdas.map((row) => [row.id, row]));
  const accountNdaByEnvelopeId = new Map(accountNdas.map((row) => [row.envelope_id, row]));
  const templateById = new Map(((templatesData ?? []) as NdaTemplateRow[]).map((row) => [row.id, row]));

  const photoUrls = new Map(
    await Promise.all(
      uniqueIds(lps.map((lp) => lp.profile_picture_storage_key)).map(async (storageKey) => [
        storageKey,
        await createLpProfilePictureSignedUrl(supabase, storageKey),
      ] as const),
    ),
  );

  const rows = auditRows.flatMap((row) => {
    const metadata = readMetadata(row.metadata);
    let investorId: string | null = null;
    let opportunityId: string | null = null;
    let ndaLabel: string | null = null;

    if (row.entity_type === 'lp' && row.entity_id) {
      investorId = row.entity_id;
    }

    if (row.entity_type === 'opportunity' && row.entity_id) {
      opportunityId = row.entity_id;
    }

    const metadataLpId = readString(metadata, 'lp_id');
    if (metadataLpId) {
      investorId = metadataLpId;
    }

    if (row.actor_profile_id) {
      investorId = lpByProfileId.get(row.actor_profile_id)?.id ?? investorId;
    }

    if (row.action === 'nda.signed') {
      if (row.entity_type === 'opportunity_nda' && row.entity_id) {
        const opportunityNda = opportunityNdaById.get(row.entity_id);
        if (opportunityNda) {
          investorId = opportunityNda.lp_id;
          opportunityId = opportunityNda.opportunity_id;
          ndaLabel = opportunityById.get(opportunityNda.opportunity_id)?.title ?? 'Opportunity NDA';
        }
      } else {
        const envelopeId = readString(metadata, 'envelope_id');
        const accountNda = row.entity_id
          ? accountNdaById.get(row.entity_id)
          : envelopeId
            ? accountNdaByEnvelopeId.get(envelopeId)
            : null;

        if (accountNda) {
          investorId = accountNda.lp_id;
          ndaLabel = templateById.get(accountNda.nda_template_id)?.name ?? 'Account NDA';
        }
      }
    }

    const lp = investorId ? lpById.get(investorId) : null;
    const investorName = lp?.full_name || lp?.email;
    if (!investorName) {
      return [];
    }

    const opportunity = opportunityId ? opportunityById.get(opportunityId) : null;
    const photoStorageKey = lp?.profile_picture_storage_key ?? null;

    return [{
      id: row.id,
      type: ACTION_TO_TYPE[row.action],
      occurredAt: row.created_at,
      investorId,
      investorName,
      investorPhotoUrl: photoStorageKey ? photoUrls.get(photoStorageKey) ?? null : null,
      opportunityId,
      opportunityTitle: opportunity?.title ?? null,
      opportunitySlug: opportunity?.slug ?? null,
      ndaLabel,
    }];
  });

  return buildPaginatedResult(rows, totalCount, page, pageSize);
}
