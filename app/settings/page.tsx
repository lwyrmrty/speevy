import Link from 'next/link';
import { redirect } from 'next/navigation';

import { LpSettingsForm } from '@/components/settings/lp-settings-form';
import { InvestorProfileSquare } from '@/components/webflow/investor-profile-square';
import { WebflowStyles } from '@/components/webflow/webflow-styles';
import { WebflowSectorIcon } from '@/components/webflow/sector-icon';
import { INVESTOR_SECTORS, type InvestorSector } from '@/lib/investor-request';
import { createLpProfilePictureSignedUrl } from '@/lib/lp-profile-picture';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type LpSettingsRow = {
  id: string;
  status: string;
  email: string;
  full_name: string | null;
  sectors_interested: unknown;
  investment_range_min_cents: number | string | null;
  investment_range_max_cents: number | string | null;
};

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
  )) as InvestorSector[];
}

function compactRangeMoney(value: number | string | null) {
  if (value === null) return '';

  const cents = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(cents) || cents <= 0) return '';

  const amount = cents / 100;
  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000;
    return `$${Number.isInteger(millions) ? millions : millions.toFixed(1)}M`;
  }

  if (amount >= 1_000) {
    return `$${Math.round(amount / 1_000)}K`;
  }

  return `$${amount.toLocaleString('en-US')}`;
}

export default async function SettingsPage() {
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
    .select('id, status, email, full_name, sectors_interested, investment_range_min_cents, investment_range_max_cents, profile_picture_storage_key')
    .eq('profile_id', user.id)
    .maybeSingle<LpSettingsRow & { profile_picture_storage_key: string | null }>();

  if (!lp) {
    redirect(profile?.role === 'admin' ? '/admin' : '/onboarding');
  }

  if (lp.status !== 'approved') {
    redirect('/onboarding');
  }

  const fullName = profile?.full_name || lp.full_name || '';
  const displayName = fullName || profile?.email || lp.email || user.email;
  const sectors = normalizeSectors(lp.sectors_interested);
  const minRange = compactRangeMoney(lp.investment_range_min_cents);
  const maxRange = compactRangeMoney(lp.investment_range_max_cents);
  const profilePhotoUrl = await createLpProfilePictureSignedUrl(
    supabase,
    lp.profile_picture_storage_key,
  );

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
              {profile?.role === 'admin' ? (
                <Link href="/admin/opportunities" className="button short secondary w-inline-block">
                  <div>Admin View</div>
                </Link>
              ) : null}
              <div className="profileblock">
                <Link href="/settings" className="profilelink w-inline-block">
                  <InvestorProfileSquare
                    fullName={fullName}
                    email={profile?.email || lp.email || user.email || ''}
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
            <div className="pagemain">
              <div className="breadcrumbrow">
                <Link href="/opportunities" className="breadcrumblink">
                  Opportunities
                </Link>
                <div className="breadcrumbdivider">//</div>
                <Link href="/settings" className="breadcrumblink w--current">
                  Settings
                </Link>
              </div>

              <div className="tableheader">
                <div>
                  <div className="pagetitle">Settings</div>
                  <div className="pagesubtitle">Keep your investor profile and deal preferences up to date.</div>
                </div>
              </div>

              <div className="pagecard full">
                <LpSettingsForm
                  email={profile?.email || lp.email || user.email || ''}
                  initialFullName={fullName}
                  initialSectors={sectors}
                  initialInvestmentRangeMinCents={lp.investment_range_min_cents}
                  initialInvestmentRangeMaxCents={lp.investment_range_max_cents}
                />
              </div>
            </div>
            <div className="pageside">
              <div className="pagecard sidecard">
                <div className="cardblock">
                  <div className="cardtitle-row">
                    <div className="sideheading large">Your Profile</div>
                    <div className="sidesubheading">This information helps Harpoon surface relevant opportunities.</div>
                  </div>
                </div>
                <div className="cardblock">
                  <div className="sideheading">Sectors</div>
                  <div className="alignrow wrap">
                    {sectors.length > 0 ? sectors.map((sector) => (
                      <div key={sector} className="pillstat _5">
                        <div className="pillicon-block">
                          <WebflowSectorIcon sector={sector} className="pillicon" />
                        </div>
                        <div>{sector}</div>
                      </div>
                    )) : (
                      <div className="sidesubheading">No sectors selected yet.</div>
                    )}
                  </div>
                </div>
                <div className="cardblock">
                  <div className="sideheading">Capital Range</div>
                  <div className="alignrow wrap">
                    {minRange && maxRange ? (
                      <div className="pillstat">
                        <div>{minRange} - {maxRange}</div>
                      </div>
                    ) : (
                      <div className="sidesubheading">No capital range selected yet.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
