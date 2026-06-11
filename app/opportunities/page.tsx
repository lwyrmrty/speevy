import Link from 'next/link';
import { redirect } from 'next/navigation';

import { GlanceChatWidget } from '@/components/glance-chat-widget';
import { SectionMiniNav } from '@/components/webflow/section-mini-nav';
import { InvestorProfileSquare } from '@/components/webflow/investor-profile-square';
import { WebflowStyles } from '@/components/webflow/webflow-styles';
import { WebflowSectorIcon } from '@/components/webflow/sector-icon';
import { INVESTOR_SECTORS } from '@/lib/investor-request';
import { createLpProfilePictureSignedUrl } from '@/lib/lp-profile-picture';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type OpportunityRow = {
  id: string;
  slug: string;
  title: string;
  teaser: string | null;
  status: 'potential' | 'coming_soon' | 'draft' | 'active' | 'closed';
  opportunity_sectors: unknown;
  stage: string | null;
  website_url: string | null;
  minimum_investment_cents: number | string | null;
  target_allocation_cents: number | string | null;
  origination_fee_cents: number | string | null;
  carry_percentage_basis_points: number | null;
  management_fee_basis_points: number | null;
  logo_storage_key: string | null;
  thumbnail_storage_key: string | null;
};

type OpportunityCardRow = OpportunityRow & {
  logoUrl: string | null;
  thumbnailUrl: string | null;
};

type InterestRow = {
  amount_cents: number | string | null;
  status: 'indicated' | 'committed' | 'withdrawn';
  opportunities: InterestOpportunity | InterestOpportunity[] | null;
};

type InterestOpportunity = {
  slug: string;
  title: string;
  logo_storage_key: string | null;
};

type InterestDisplayRow = InterestRow & {
  logoUrl: string | null;
};

type LpSidebarRow = {
  id: string;
  status: string;
  full_name: string | null;
  sectors_interested: unknown;
  investment_range_min_cents: number | string | null;
  investment_range_max_cents: number | string | null;
};

function centsToNumber(value: number | string | null) {
  if (value === null) return 0;
  return typeof value === 'string' ? Number(value) : value;
}

function compactMoney(value: number | string | null) {
  const amount = centsToNumber(value) / 100;

  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000;
    return `$${Number.isInteger(millions) ? millions : millions.toFixed(1)} Million`;
  }

  if (amount >= 1_000) {
    return `$${Math.round(amount / 1_000)}k`;
  }

  return amount ? `$${amount.toLocaleString('en-US')}` : '$0';
}

function compactShortMoney(value: number | string | null) {
  const amount = centsToNumber(value) / 100;

  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000;
    return `$${Number.isInteger(millions) ? millions : millions.toFixed(1)}M`;
  }

  if (amount >= 1_000) {
    return `$${Math.round(amount / 1_000)}k`;
  }

  return amount ? `$${amount.toLocaleString('en-US')}` : '-';
}

function compactRangeMoney(value: number | string | null) {
  const amount = centsToNumber(value) / 100;

  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000;
    return `$${Number.isInteger(millions) ? millions : millions.toFixed(1)}M`;
  }

  if (amount >= 1_000) {
    return `$${Math.round(amount / 1_000)}K`;
  }

  return amount ? `$${amount.toLocaleString('en-US')}` : '';
}

function normalizeSectors(value: unknown) {
  const sectors = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? [value]
      : [];

  return Array.from(new Set(
    sectors.filter((sector): sector is string =>
      typeof sector === 'string'
      && sector.trim().length > 0
      && (INVESTOR_SECTORS as readonly string[]).includes(sector),
    ),
  ));
}

function getInterestOpportunity(opportunities: InterestRow['opportunities']) {
  return Array.isArray(opportunities) ? opportunities[0] : opportunities;
}

function sortOpportunitiesByTitle(opportunities: OpportunityCardRow[]) {
  return opportunities.slice().sort((left, right) =>
    left.title.localeCompare(right.title, undefined, { sensitivity: 'base' }),
  );
}

function externalUrl(value: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function basisPointsToPercent(value: number | null) {
  if (value === null) return '';
  const percent = value / 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(2)}%`;
}

function StatusPill({ status }: { status: OpportunityRow['status'] }) {
  if (status === 'active') {
    return (
      <div className="pillstat green">
        <div>Active</div>
      </div>
    );
  }

  return (
    <div className="pillstat">
      <div>{status.charAt(0).toUpperCase() + status.slice(1)}</div>
    </div>
  );
}

function stageLabel(stage: string | null | undefined): string | null {
  const trimmed = stage?.trim();
  return trimmed ? trimmed : null;
}

function OpportunityStats({ opportunity }: { opportunity: OpportunityCardRow }) {
  const carry = basisPointsToPercent(opportunity.carry_percentage_basis_points);
  const managementFee = basisPointsToPercent(opportunity.management_fee_basis_points);
  const raiseLabel = centsToNumber(opportunity.target_allocation_cents)
    ? compactMoney(opportunity.target_allocation_cents)
    : null;
  const minimumLabel = centsToNumber(opportunity.minimum_investment_cents)
    ? compactMoney(opportunity.minimum_investment_cents)
    : null;
  const originationFeeLabel = centsToNumber(opportunity.origination_fee_cents)
    ? compactMoney(opportunity.origination_fee_cents)
    : null;
  const opportunityStageLabel = stageLabel(opportunity.stage);

  return (
    <div className="div-block-2">
      <div className="alignrow wrap">
        {raiseLabel ? (
          <div className="pillstat">
            <div>{raiseLabel}</div>
          </div>
        ) : null}
        <div className="pillstat">
          <div>{carry ? `${carry} Carry` : '0% Carry'}</div>
        </div>
        <div className="pillstat">
          <div>{managementFee ? `${managementFee} Fee` : 'No Fee'}</div>
        </div>
        {originationFeeLabel ? (
          <div className="pillstat">
            <div><span className="dimish">Origination:</span> {originationFeeLabel}</div>
          </div>
        ) : null}
      </div>
      {opportunityStageLabel || minimumLabel ? (
        <div className="alignrow wrap">
          {opportunityStageLabel ? (
            <div className="pillstat">
              <div><span className="dimish">Stage:</span> {opportunityStageLabel}</div>
            </div>
          ) : null}
          {minimumLabel ? (
            <div className="pillstat">
              <div><span className="dimish">Min:</span> {minimumLabel}</div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function OpportunitySectorPills({
  sectors,
  alignRight = false,
}: {
  sectors: unknown;
  alignRight?: boolean;
}) {
  const normalizedSectors = normalizeSectors(sectors);

  if (normalizedSectors.length === 0) {
    return null;
  }

  return (
    <div className={`alignrow${alignRight ? ' alignright' : ''}`}>
      {normalizedSectors.map((sector) => (
        <div key={sector} className="pillstat _5">
          <div className="pillicon-block">
            <WebflowSectorIcon sector={sector} className="pillicon" />
          </div>
          <div>{sector}</div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="cardlist-item">
      <div className="cardrow">
        <div className="cardtitle-row">
          <div className="cardtitle">No {label.toLowerCase()} right now</div>
          <div className="cardsubtitle">New opportunities will appear here once available.</div>
        </div>
      </div>
    </div>
  );
}

function ActiveOpportunityCard({ opportunity }: { opportunity: OpportunityCardRow }) {
  return (
    <div className="carditem">
      <Link href={`/opportunities/${opportunity.slug}`} className="pagecard spacing w-inline-block">
        <div className="cardthumbnail abs">
          <img
            src={opportunity.thumbnailUrl ?? '/webflow/images/cyberwallpaper.webp'}
            loading="lazy"
            alt=""
            className="fullimage"
          />
          <div className="thumbnailoverlay">
            <div className="abstl">
              <StatusPill status={opportunity.status} />
            </div>
            <div className="abstr" />
          </div>
        </div>
        <div className="cardcontent rounded">
          <div className="alignrow _10">
            <div className="cardlogo">
              <img
                src={opportunity.logoUrl ?? '/webflow/images/frontierSec.webp'}
                loading="lazy"
                alt=""
                className="fullimage"
              />
            </div>
            <div className="cardtitle-row">
              <div className="cardtitle">{opportunity.title}</div>
              <div className="cardsubtitle">{opportunity.teaser}</div>
            </div>
          </div>
          <div className="spacer _0" />
          <OpportunitySectorPills sectors={opportunity.opportunity_sectors} />
          <div className="linedivider" />
          <OpportunityStats opportunity={opportunity} />
        </div>
      </Link>
    </div>
  );
}

function CompactOpportunityRow({
  opportunity,
  disabled = false,
}: {
  opportunity: OpportunityCardRow;
  disabled?: boolean;
}) {
  const href = `/opportunities/${opportunity.slug}`;
  const opportunityStageLabel = stageLabel(opportunity.stage);

  return (
    <div className="cardlist-item">
      <Link href={href} className="cardrow w-inline-block">
        <div className="cardlogo-row">
          {disabled ? null : (
            <div className="rowthumb">
              <img
                src={opportunity.thumbnailUrl ?? '/webflow/images/carl-wang-OCe8cTGymSQ-unsplash.jpg'}
                loading="lazy"
                alt=""
                className="fullimage"
              />
              <div className="featuredoverlay" />
            </div>
          )}
          <div className={`cardlogo-logo${disabled ? ' nopull' : ''}`}>
            <img
              src={opportunity.logoUrl ?? '/webflow/images/YJnP6Zn5_400x400.jpg'}
              loading="lazy"
              alt=""
              className="fullimage"
            />
          </div>
          <div className="cardtitle-row">
            <div className="cardtitle">{opportunity.title}</div>
            <div className="cardsubtitle">{opportunity.teaser}</div>
          </div>
        </div>
        <div className="statsright">
          <OpportunitySectorPills sectors={opportunity.opportunity_sectors} alignRight />
          {opportunityStageLabel ? (
            <div className="alignrow wrap alignright">
              <div className="pillstat">
                <div><span className="dimish">Stage:</span> {opportunityStageLabel}</div>
              </div>
            </div>
          ) : null}
        </div>
      </Link>
    </div>
  );
}

function ClosedOpportunityCard({ opportunity }: { opportunity: OpportunityCardRow }) {
  const websiteHref = externalUrl(opportunity.website_url);
  const detailHref = `/opportunities/${opportunity.slug}`;

  const cardContent = (
    <div className="cardlogo-row">
      <div className="cardlogo-logo nopull closed-logo">
        <img
          src={opportunity.logoUrl ?? '/webflow/images/YJnP6Zn5_400x400.jpg'}
          loading="lazy"
          alt=""
          className="fullimage"
        />
      </div>
      <div className="cardtitle-row">
        <div className="cardtitle">{opportunity.title}</div>
        <div className="cardsubtitle">{opportunity.teaser}</div>
      </div>
    </div>
  );

  return (
    <div className="cardlist-item">
      {websiteHref ? (
        <a
          href={websiteHref}
          target="_blank"
          rel="noopener noreferrer"
          className="cardrow w-inline-block"
        >
          {cardContent}
        </a>
      ) : (
        <Link href={detailHref} className="cardrow w-inline-block">
          {cardContent}
        </Link>
      )}
    </div>
  );
}

function InterestedOpportunities({
  interests,
}: {
  interests: InterestDisplayRow[];
}) {
  if (interests.length === 0) {
    return (
      <div className="sidelinks-list">
        <div className="sidelink borders">
          <div className="sidesubheading">No interested opportunities yet.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="sidelinks-list">
      {interests.map((interest) => {
        const opportunity = getInterestOpportunity(interest.opportunities);
        if (!opportunity) return null;

        return (
          <Link
            key={opportunity.slug}
            href={`/opportunities/${opportunity.slug}#opportunity-top`}
            className="sidelink borders w-inline-block"
          >
            <div className="alignrow aligncenter _10">
              <div className="sidelink-icon med">
                <img
                  src={interest.logoUrl ?? '/webflow/images/frontierSec.webp'}
                  loading="lazy"
                  alt=""
                  className="fullimage"
                />
              </div>
              <div>{opportunity.title}</div>
            </div>
            {interest.amount_cents === null ? null : (
              <div className="dollaramount">{compactShortMoney(interest.amount_cents)}</div>
            )}
          </Link>
        );
      })}
    </div>
  );
}

function InterestedSectors({ sectors }: { sectors: string[] }) {
  if (sectors.length === 0) {
    return (
      <div className="sidelink borders">
        <div className="sidesubheading">No sectors selected yet.</div>
      </div>
    );
  }

  return (
    <>
      {sectors.map((sector) => (
        <div key={sector} className="pillstat _5">
          <div className="pillicon-block">
            <WebflowSectorIcon sector={sector} className="pillicon" />
          </div>
          <div>{sector}</div>
        </div>
      ))}
    </>
  );
}

function CapitalRange({
  minCents,
  maxCents,
}: {
  minCents: number | string | null;
  maxCents: number | string | null;
}) {
  const minLabel = compactRangeMoney(minCents);
  const maxLabel = compactRangeMoney(maxCents);

  if (!minLabel || !maxLabel) {
    return (
      <div className="sidelink borders">
        <div className="sidesubheading">No capital range selected yet.</div>
      </div>
    );
  }

  return (
    <div className="pillstat">
      <div>{minLabel} - {maxLabel}</div>
    </div>
  );
}

export default async function OpportunitiesHomePage() {
  const serverSupabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const supabase = createSupabaseAdminClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .maybeSingle();

  const { data: lp } = await supabase
    .from('lps')
    .select('id, status, full_name, sectors_interested, investment_range_min_cents, investment_range_max_cents, profile_picture_storage_key')
    .eq('profile_id', user.id)
    .maybeSingle<LpSidebarRow & { profile_picture_storage_key: string | null }>();

  const isAdmin = profile?.role === 'admin';
  const isApprovedLp = lp?.status === 'approved';

  if (!isAdmin && !isApprovedLp) {
    redirect('/onboarding');
  }

  const opportunitiesClient = isAdmin ? supabase : serverSupabase;
  const { data: opportunities } = await opportunitiesClient
    .from('opportunities')
    .select(`
      id,
      slug,
      title,
      teaser,
      status,
      opportunity_sectors,
      stage,
      website_url,
      minimum_investment_cents,
      target_allocation_cents,
      origination_fee_cents,
      carry_percentage_basis_points,
      management_fee_basis_points,
      logo_storage_key,
      thumbnail_storage_key
    `)
    // Match insider RLS (`status <> 'draft'`). Avoid `.in()` with enum values that
    // may not exist yet (e.g. `coming_soon` before migration 0019) — PostgREST
    // rejects invalid enum literals and the page would silently show empty sections.
    .neq('status', 'draft')
    .is('archived_at', null)
    .order('created_at', { ascending: false });

  const signedAssetUrl = async (storageKey: string | null) => {
    if (!storageKey) return null;
    const { data } = await supabase.storage
      .from('opportunity-assets')
      .createSignedUrl(storageKey, 60 * 60);
    return data?.signedUrl ?? null;
  };

  const rows = (opportunities ?? []) as OpportunityRow[];
  const cards = await Promise.all(
    rows.map(async (opportunity) => ({
      ...opportunity,
      logoUrl: await signedAssetUrl(opportunity.logo_storage_key),
      thumbnailUrl: await signedAssetUrl(opportunity.thumbnail_storage_key),
    })),
  );
  const { data: interestsData } = lp?.id
    ? await supabase
      .from('interests')
      .select(`
        amount_cents,
        status,
        opportunities (
          slug,
          title,
          logo_storage_key
        )
      `)
      .eq('lp_id', lp.id)
      .neq('status', 'withdrawn')
      .order('indicated_at', { ascending: false })
    : { data: [] };
  const interestRows = (interestsData ?? []) as InterestRow[];
  const interestDisplays = await Promise.all(
    interestRows.map(async (interest) => ({
      ...interest,
      logoUrl: await signedAssetUrl(getInterestOpportunity(interest.opportunities)?.logo_storage_key ?? null),
    })),
  );
  const displayName = profile?.full_name || lp?.full_name || profile?.email || user.email;
  const profilePhotoUrl = await createLpProfilePictureSignedUrl(
    supabase,
    lp?.profile_picture_storage_key,
  );
  const firstName = (profile?.full_name || lp?.full_name)?.trim().split(/\s+/)[0] ?? 'there';
  const interestedSectors = normalizeSectors(lp?.sectors_interested);
  const activeOpportunities = sortOpportunitiesByTitle(
    cards.filter((opportunity) => opportunity.status === 'active'),
  );
  const potentialOpportunities = sortOpportunitiesByTitle(
    cards.filter((opportunity) => opportunity.status === 'potential'),
  );
  const comingSoonOpportunities = sortOpportunitiesByTitle(
    cards.filter((opportunity) => opportunity.status === 'coming_soon'),
  );
  const closedOpportunities = sortOpportunitiesByTitle(
    cards.filter((opportunity) => opportunity.status === 'closed'),
  );
  const opportunityNavItems = [
    { href: '#active', label: 'Active Opportunities' },
    { href: '#coming-soon', label: 'Coming Soon' },
    { href: '#potential', label: 'Potential Opportunities' },
    { href: '#closed', label: 'Closed Opportunities' },
  ];

  return (
    <>
      <WebflowStyles />
      <div className="pagewrapper">
        <div className="pagenav">
          <div className="pagecontainer navcontainer">
            <div className="navalign">
              <Link href="/opportunities" className="navlogo-link w-inline-block">
                <img
                  loading="lazy"
                  src="/webflow/images/Harpoon-Logo.png"
                  alt="Harpoon"
                  sizes="(max-width: 931px) 100vw, 931px"
                  srcSet="/webflow/images/Harpoon-Logo-p-500.png 500w, /webflow/images/Harpoon-Logo-p-800.png 800w, /webflow/images/Harpoon-Logo.png 931w"
                  className="navlogo"
                />
              </Link>
              <div className="navalign">
                <Link href="/opportunities" className="navlink w-inline-block">
                  <div>All Opportunities</div>
                </Link>
              </div>
            </div>
            <div className="navalign">
              {isAdmin ? (
                <Link href="/admin/opportunities" className="button short secondary w-inline-block">
                  <div>Admin View</div>
                </Link>
              ) : null}
              <div className="profileblock">
                <Link href="/settings" className="profilelink w-inline-block">
                  <InvestorProfileSquare
                    fullName={profile?.full_name || lp?.full_name || null}
                    email={profile?.email || user.email || ''}
                    photoUrl={profilePhotoUrl}
                  />
                  <div className="text-block">{displayName}</div>
                </Link>
              </div>
            </div>
          </div>
        </div>
        <div className="pagecontainer">
          <div className="pagecontent">
            <div className="pagemain nogap">
              <SectionMiniNav
                items={opportunityNavItems}
                className="innernav sidenav"
                linkClassName="innerpage-links shrink w-inline-block"
              />
              <div id="active" className="contentblock">
                <div className="tableheader">
                  <div>
                    <div className="pagetitle">Active Opportunities</div>
                    <div className="pagesubtitle">Opportunities we are actively raising for right now</div>
                  </div>
                </div>
                <div className="cardlist">
                  {activeOpportunities.length > 0
                    ? activeOpportunities.map((opportunity) => (
                      <ActiveOpportunityCard key={opportunity.id} opportunity={opportunity} />
                    ))
                    : <EmptyState label="Active Opportunities" />}
                </div>
              </div>
              <div id="coming-soon" className="contentblock">
                <div className="tableheader">
                  <div>
                    <div className="pagetitle">Coming Soon</div>
                    <div className="pagesubtitle">Opportunities launching soon. Share your interest and estimated allocation amount to reserve your spot before it becomes active.</div>
                  </div>
                </div>
                <div className="cardlist nomargin">
                  {comingSoonOpportunities.length > 0
                    ? comingSoonOpportunities.map((opportunity) => (
                      <CompactOpportunityRow key={opportunity.id} opportunity={opportunity} />
                    ))
                    : <EmptyState label="Coming Soon Opportunities" />}
                </div>
              </div>
              <div id="potential" className="contentblock">
                <div className="tableheader">
                  <div>
                    <div className="pagetitle">Potential Opportunities</div>
                    <div className="pagesubtitle">Opportunities that might be coming in the future. We encourage you to share interest and estimated allocations regardless, as we expect these to fill up fast.</div>
                  </div>
                </div>
                <div className="cardlist nomargin">
                  {potentialOpportunities.length > 0
                    ? potentialOpportunities.map((opportunity) => (
                      <CompactOpportunityRow key={opportunity.id} opportunity={opportunity} disabled />
                    ))
                    : <EmptyState label="Potential Opportunities" />}
                </div>
              </div>
              <div id="closed" className="contentblock">
                <div className="tableheader">
                  <div>
                    <div className="pagetitle">Closed Opportunities</div>
                    <div className="pagesubtitle">Opportunities that have closed. However, they could come again in the future.</div>
                  </div>
                </div>
                <div className="cardlist nomargin closed-grid">
                  {closedOpportunities.length > 0
                    ? closedOpportunities.map((opportunity) => (
                      <ClosedOpportunityCard key={opportunity.id} opportunity={opportunity} />
                    ))
                    : <EmptyState label="Closed Opportunities" />}
                </div>
              </div>
            </div>
            <div className="pageside">
              <div className="pagecard sidecard">
                <div className="cardblock">
                  <div className="cardtitle-row">
                    <div className="sideheading large">Hi, {firstName}</div>
                    <div className="sidesubheading">Welcome to your Harpoon Ventures opportunities dashboard. </div>
                  </div>
                </div>
                <div className="cardblock">
                  <div>
                    <div className="sideheading">Opportunities Interested</div>
                    <div className="sidesubheading">Opportunities you&#x27;ve shown interest in</div>
                  </div>
                  <div>
                    <InterestedOpportunities interests={interestDisplays} />
                  </div>
                </div>
                <div className="cardblock">
                  <div>
                    <div className="sideheading">Sectors Interested</div>
                    <div className="sidesubheading">Sectors you said you are interested in</div>
                  </div>
                  <div className="alignrow wrap">
                    <InterestedSectors sectors={interestedSectors} />
                  </div>
                </div>
                <div className="cardblock">
                  <div>
                    <div className="sideheading">Capital Range</div>
                    <div className="sidesubheading">The range you can potentially invest per deal</div>
                  </div>
                  <div className="alignrow wrap">
                    <CapitalRange
                      minCents={lp?.investment_range_min_cents ?? null}
                      maxCents={lp?.investment_range_max_cents ?? null}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <GlanceChatWidget />
      </div>
    </>
  );
}
