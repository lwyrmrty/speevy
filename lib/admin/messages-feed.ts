import {
  LP_EMAIL_TEMPLATE_KINDS,
  type LpEmailTemplateKind,
} from '@/lib/admin/log-lp-email-sent';
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

export type MessageFeedType = LpEmailTemplateKind;

export type MessageFeedRow = {
  id: string;
  type: MessageFeedType;
  occurredAt: string;
  investorId: string | null;
  investorName: string;
  investorPhotoUrl: string | null;
  opportunityId: string | null;
  opportunityTitle: string | null;
  opportunitySlug: string | null;
  newStatus: string | null;
  previousStatus: string | null;
  ndaName: string | null;
};

type AuditRow = {
  id: string;
  entity_id: string | null;
  metadata: unknown;
  created_at: string;
};

type LpRow = {
  id: string;
  full_name: string | null;
  email: string;
  profile_picture_storage_key: string | null;
};

type OpportunityRow = {
  id: string;
  slug: string;
  title: string;
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

function readTemplate(metadata: Record<string, unknown> | null): MessageFeedType | null {
  const template = readString(metadata, 'template');
  if (!template) {
    return null;
  }

  return (LP_EMAIL_TEMPLATE_KINDS as readonly string[]).includes(template)
    ? (template as MessageFeedType)
    : null;
}

export function formatMessageRelativeTime(iso: string) {
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

export async function getMessagesFeed(options: {
  page?: number;
  pageSize?: number;
} = {}): Promise<PaginatedResult<MessageFeedRow>> {
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const requestedPage = options.page ?? 1;
  const supabase = createSupabaseAdminClient();

  const { count } = await supabase
    .from('audit_log')
    .select('id', { count: 'exact', head: true })
    .eq('action', 'email.sent');

  const totalCount = count ?? 0;
  const totalPages = getTotalPages(totalCount, pageSize);
  const page = clampPage(requestedPage, totalPages);
  const offset = getPaginationOffset(page, pageSize);

  if (totalCount === 0) {
    return buildPaginatedResult([], 0, page, pageSize);
  }

  const { data: auditData } = await supabase
    .from('audit_log')
    .select('id, entity_id, metadata, created_at')
    .eq('action', 'email.sent')
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  const auditRows = (auditData ?? []) as AuditRow[];
  if (!auditRows.length) {
    return buildPaginatedResult([], totalCount, page, pageSize);
  }

  const metadataLpIds = auditRows.map((row) => readString(readMetadata(row.metadata), 'lp_id'));
  const lpIds = uniqueIds([...metadataLpIds, ...auditRows.map((row) => row.entity_id)]);
  const opportunityIds = uniqueIds(
    auditRows.map((row) => readString(readMetadata(row.metadata), 'opportunity_id')),
  );

  const [{ data: lpsData }, { data: opportunitiesData }] = await Promise.all([
    lpIds.length
      ? supabase
        .from('lps')
        .select('id, full_name, email, profile_picture_storage_key')
        .in('id', lpIds)
        .neq('status', 'removed')
      : Promise.resolve({ data: [] }),
    opportunityIds.length
      ? supabase
        .from('opportunities')
        .select('id, slug, title')
        .in('id', opportunityIds)
      : Promise.resolve({ data: [] }),
  ]);

  const lps = (lpsData ?? []) as LpRow[];
  const opportunities = (opportunitiesData ?? []) as OpportunityRow[];
  const lpById = new Map(lps.map((lp) => [lp.id, lp]));
  const opportunityById = new Map(opportunities.map((opportunity) => [opportunity.id, opportunity]));

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
    const type = readTemplate(metadata);
    if (!type) {
      return [];
    }

    const investorId = readString(metadata, 'lp_id') ?? row.entity_id;
    const lp = investorId ? lpById.get(investorId) : null;
    const investorName = lp?.full_name || lp?.email;
    if (!investorName) {
      return [];
    }

    const opportunityId = readString(metadata, 'opportunity_id');
    const opportunity = opportunityId ? opportunityById.get(opportunityId) : null;
    const photoStorageKey = lp?.profile_picture_storage_key ?? null;

    return [{
      id: row.id,
      type,
      occurredAt: row.created_at,
      investorId,
      investorName,
      investorPhotoUrl: photoStorageKey ? photoUrls.get(photoStorageKey) ?? null : null,
      opportunityId,
      opportunityTitle: opportunity?.title ?? null,
      opportunitySlug: opportunity?.slug ?? null,
      newStatus: readString(metadata, 'new_status'),
      previousStatus: readString(metadata, 'previous_status'),
      ndaName: readString(metadata, 'nda_name'),
    }];
  });

  return buildPaginatedResult(rows, totalCount, page, pageSize);
}
