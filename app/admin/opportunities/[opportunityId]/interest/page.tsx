import Link from 'next/link';
import { notFound } from 'next/navigation';

import { OpportunityInterestTable } from '@/components/admin/opportunity-interest-table';
import { requireAdmin } from '@/lib/auth/admin';
import {
  centsToNumber,
  isPipelineStatus,
  isPriority,
  type InterestCrmNote,
  type InterestCrmRow,
  type InterestCrmTeamMember,
} from '@/lib/interest-crm';
import { createLpProfilePictureSignedUrl } from '@/lib/lp-profile-picture';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type InterestLp = {
  email: string;
  full_name: string | null;
  entity_name: string | null;
  profile_picture_storage_key: string | null;
};

type InterestQueryRow = {
  id: string;
  lp_id: string;
  amount_cents: number | string | null;
  indicated_at: string;
  pipeline_status: string;
  priority: string | null;
  owner_profile_id: string | null;
  confirmed_amount_cents: number | string | null;
  confirmed_by_profile_id: string | null;
  confirmed_at: string | null;
  lps: InterestLp | InterestLp[] | null;
};

type NoteQueryRow = {
  id: string;
  interest_id: string;
  author_profile_id: string;
  body: string;
  created_at: string;
};

type ProfileQueryRow = {
  id: string;
  email: string;
  full_name: string | null;
  profile_picture_storage_key: string | null;
};

function getInterestLp(lps: InterestQueryRow['lps']) {
  return Array.isArray(lps) ? lps[0] : lps;
}

function profileLabel(profile: ProfileQueryRow | undefined) {
  if (!profile) return null;
  return profile.full_name || profile.email;
}

export default async function OpportunityInterestPage({
  params,
}: {
  params: Promise<{ opportunityId: string }>;
}) {
  const { opportunityId } = await params;
  const { profile: currentAdminProfile } = await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const { data: opportunity } = await supabase
    .from('opportunities')
    .select('id, slug, title')
    .eq('slug', opportunityId)
    .maybeSingle();

  if (!opportunity) {
    notFound();
  }

  const [{ data: interestsData }, { data: teamData }] = await Promise.all([
    supabase
      .from('interests')
      .select(`
        id,
        lp_id,
        amount_cents,
        indicated_at,
        pipeline_status,
        priority,
        owner_profile_id,
        confirmed_amount_cents,
        confirmed_by_profile_id,
        confirmed_at,
        lps (
          email,
          full_name,
          entity_name,
          profile_picture_storage_key
        )
      `)
      .eq('opportunity_id', opportunity.id)
      .neq('status', 'withdrawn')
      .order('indicated_at', { ascending: false }),
    supabase
      .from('profiles')
      .select('id, email, full_name, profile_picture_storage_key')
      .eq('role', 'admin')
      .order('full_name', { ascending: true }),
  ]);

  // Supabase nested selects are untyped; shape is asserted to the query above.
  const interestRows = (interestsData ?? []) as InterestQueryRow[];
  const adminProfiles = (teamData ?? []) as ProfileQueryRow[];
  const profileById = new Map<string, ProfileQueryRow>(
    adminProfiles.map((profile) => [profile.id, profile]),
  );

  const interestIds = interestRows.map((row) => row.id);
  const { data: notesData } = interestIds.length
    ? await supabase
        .from('interest_notes')
        .select('id, interest_id, author_profile_id, body, created_at')
        .in('interest_id', interestIds)
        .order('created_at', { ascending: true })
    : { data: [] as NoteQueryRow[] };

  const notesByInterestId = new Map<string, InterestCrmNote[]>();
  // Notes query is untyped from supabase-js; columns match NoteQueryRow.
  for (const note of (notesData ?? []) as NoteQueryRow[]) {
    const author = profileById.get(note.author_profile_id);
    const list = notesByInterestId.get(note.interest_id) ?? [];
    list.push({
      id: note.id,
      body: note.body,
      createdAt: note.created_at,
      authorProfileId: note.author_profile_id,
      authorName: profileLabel(author) ?? 'Harpoon team',
    });
    notesByInterestId.set(note.interest_id, list);
  }

  const profilePictureStorageKeys = Array.from(new Set(
    [
      ...interestRows.map((interest) => getInterestLp(interest.lps)?.profile_picture_storage_key),
      ...adminProfiles.map((profile) => profile.profile_picture_storage_key),
    ].filter((key): key is string => Boolean(key)),
  ));
  const profilePictureUrls = new Map(
    await Promise.all(
      profilePictureStorageKeys.map(async (storageKey) => [
        storageKey,
        await createLpProfilePictureSignedUrl(supabase, storageKey),
      ] as const),
    ),
  );

  function photoUrlFor(storageKey: string | null | undefined) {
    return storageKey ? profilePictureUrls.get(storageKey) ?? null : null;
  }

  const teamMembers: InterestCrmTeamMember[] = adminProfiles.map((profile) => ({
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    photoUrl: photoUrlFor(profile.profile_picture_storage_key),
  }));

  const currentAdminProfileRow = profileById.get(currentAdminProfile.id);
  const currentAdmin: InterestCrmTeamMember = currentAdminProfileRow
    ? {
        id: currentAdminProfileRow.id,
        email: currentAdminProfileRow.email,
        fullName: currentAdminProfileRow.full_name,
        photoUrl: photoUrlFor(currentAdminProfileRow.profile_picture_storage_key),
      }
    : {
        id: currentAdminProfile.id,
        email: '',
        fullName: null,
        photoUrl: null,
      };

  const rows: InterestCrmRow[] = interestRows.map((interest) => {
    const lp = getInterestLp(interest.lps);
    const investorName = lp?.full_name || lp?.email || 'Unknown investor';
    const owner = interest.owner_profile_id ? profileById.get(interest.owner_profile_id) : undefined;
    const confirmedBy = interest.confirmed_by_profile_id
      ? profileById.get(interest.confirmed_by_profile_id)
      : undefined;
    const photoKey = lp?.profile_picture_storage_key;

    return {
      id: interest.id,
      lpId: interest.lp_id,
      investorName,
      investorEmail: lp?.email || '',
      entityName: lp?.entity_name ?? null,
      photoUrl: photoKey ? profilePictureUrls.get(photoKey) ?? null : null,
      amountCents: centsToNumber(interest.amount_cents),
      indicatedAt: interest.indicated_at,
      confirmedAmountCents: interest.confirmed_amount_cents == null
        ? null
        : centsToNumber(interest.confirmed_amount_cents),
      confirmedByName: profileLabel(confirmedBy),
      confirmedAt: interest.confirmed_at,
      pipelineStatus: isPipelineStatus(interest.pipeline_status) ? interest.pipeline_status : 'interested',
      priority: isPriority(interest.priority) ? interest.priority : null,
      ownerProfileId: interest.owner_profile_id,
      ownerName: profileLabel(owner),
      notes: notesByInterestId.get(interest.id) ?? [],
    };
  });

  return (
    <div className="pagecontainer admincontainer">
      <div className="breadcrumbrow">
        <Link href="/admin/opportunities" className="breadcrumbicon w-inline-block" aria-label="Opportunities">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            className="homeicon"
          >
            <g>
              <path d="M19.5 0H22C23.1046 0 24 0.895453 24 2.00002V4.5C24 5.60456 23.1046 6.50002 22 6.50002H19.5C18.3955 6.50002 17.5 5.60456 17.5 4.5V2.00002C17.5 0.895453 18.3955 0 19.5 0Z" fill="currentColor" />
              <path d="M10.75 0H13.25C14.3546 0 15.25 0.895453 15.25 2.00002V4.5C15.25 5.60456 14.3546 6.50002 13.25 6.50002H10.75C9.64545 6.50002 8.75 5.60456 8.75 4.5V2.00002C8.75005 0.895453 9.64545 0 10.75 0Z" fill="currentColor" />
              <path d="M2.00002 0H4.5C5.60456 0 6.50002 0.895453 6.50002 2.00002V4.5C6.50002 5.60456 5.60456 6.50002 4.5 6.50002H2.00002C0.895453 6.50002 0 5.60456 0 4.5V2.00002C0 0.895453 0.895453 0 2.00002 0Z" fill="currentColor" />
              <path d="M19.5 8.75H22C23.1046 8.75 24 9.64545 24 10.75V13.25C24 14.3546 23.1046 15.25 22 15.25H19.5C18.3955 15.25 17.5 14.3546 17.5 13.25V10.75C17.5 9.64541 18.3955 8.75 19.5 8.75Z" fill="currentColor" />
              <path d="M10.75 8.75H13.25C14.3546 8.75 15.25 9.64545 15.25 10.75V13.25C15.25 14.3546 14.3546 15.25 13.25 15.25H10.75C9.64545 15.25 8.75 14.3546 8.75 13.25V10.75C8.75005 9.64541 8.75 8.75 10.75 8.75Z" fill="currentColor" />
              <path d="M2.00002 8.75H4.5C5.60456 8.75 6.50002 9.64545 6.50002 10.75V13.25C6.50002 14.3546 5.60456 15.25 4.5 15.25H2.00002C0.895453 8.75 0 9.64541 0 13.25V10.75C0 9.64541 0.895453 8.75 2.00002 8.75Z" fill="currentColor" />
              <path d="M19.5 17.5H22C23.1046 17.5 24 18.3955 24 19.5V22C24 23.1046 23.1046 24 22 24H19.5C18.3955 24 17.5 23.1046 17.5 22V19.5C17.5 18.3955 18.3955 17.5 19.5 17.5Z" fill="currentColor" />
              <path d="M10.75 17.5H13.25C14.3546 17.5 15.25 18.3955 15.25 19.5V22C15.25 23.1046 14.3546 24 13.25 24H10.75C9.64545 24 8.75 23.1046 8.75 22V19.5C8.75005 18.3955 9.64545 17.5 10.75 17.5Z" fill="currentColor" />
              <path d="M2.00002 17.5H4.5C5.60456 17.5 6.50002 18.3955 6.50002 19.5V22C6.50002 23.1046 5.60456 24 4.5 24H2.00002C0.895453 24 0 23.1046 0 22V19.5C0 18.3955 0.895453 17.5 2.00002 17.5Z" fill="currentColor" />
            </g>
          </svg>
        </Link>
        <Link href={`/admin/opportunities/${opportunity.slug}/edit`} className="breadcrumblink">
          {opportunity.title}
        </Link>
      </div>
      <div className="adminnav-links">
        <Link href={`/admin/opportunities/${opportunity.slug}/edit`} className="admin-navlink w-inline-block">
          <div>Edit Opportunity</div>
        </Link>
        <Link
          href={`/admin/opportunities/${opportunity.slug}/interest`}
          aria-current="page"
          className="admin-navlink w-inline-block w--current"
        >
          <div>Investor Interest</div>
        </Link>
      </div>
      <div className="pagecontent lowtop">
        <div className="pagemain speevy-interest-crm">
          <OpportunityInterestTable
            opportunitySlug={opportunity.slug}
            opportunityTitle={opportunity.title}
            rows={rows}
            teamMembers={teamMembers}
            currentAdmin={currentAdmin}
          />
        </div>
      </div>
    </div>
  );
}
