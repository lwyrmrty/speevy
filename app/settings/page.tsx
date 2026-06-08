import Link from 'next/link';
import { redirect } from 'next/navigation';

import { LpSettingsForm } from '@/components/settings/lp-settings-form';
import { WebflowStyles } from '@/components/webflow/webflow-styles';
import { WebflowSectorIcon } from '@/components/webflow/sector-icon';
import { INVESTOR_SECTORS, type InvestorSector } from '@/lib/investor-request';
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

function GearIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" className="usericon">
      <path fill="currentColor" d="m2.845 16.136 1 1.73c.531.917 1.809 1.261 2.73.73l.529-.306A8.1 8.1 0 0 0 9 19.402V20c0 1.103.897 2 2 2h2c1.103 0 2-.897 2-2v-.598a8.132 8.132 0 0 0 1.896-1.111l.529.306c.923.53 2.198.188 2.731-.731l.999-1.729a2.001 2.001 0 0 0-.731-2.732l-.505-.292a7.718 7.718 0 0 0 0-2.224l.505-.292a2.002 2.002 0 0 0 .731-2.732l-.999-1.729c-.531-.92-1.808-1.265-2.731-.732l-.529.306A8.1 8.1 0 0 0 15 4.598V4c0-1.103-.897-2-2-2h-2c-1.103 0-2 .897-2 2v.598a8.132 8.132 0 0 0-1.896 1.111l-.529-.306c-.924-.531-2.2-.187-2.731.732l-.999 1.729a2.001 2.001 0 0 0 .731 2.732l.505.292a7.683 7.683 0 0 0 0 2.223l-.505.292a2.003 2.003 0 0 0-.731 2.733zm3.326-2.758A5.703 5.703 0 0 1 6 12c0-.462.058-.926.17-1.378a.999.999 0 0 0-.47-1.108l-1.123-.65.998-1.729 1.145.662a.997.997 0 0 0 1.188-.142 6.071 6.071 0 0 1 2.384-1.399A1 1 0 0 0 11 5.3V4h2v1.3a1 1 0 0 0 .708.956 6.083 6.083 0 0 1 2.384 1.399.999.999 0 0 0 1.188.142l1.144-.661 1 1.729-1.124.649a1 1 0 0 0-.47 1.108c.112.452.17.916.17 1.378 0 .461-.058.925-.171 1.378a1 1 0 0 0 .471 1.108l1.123.649-.998 1.729-1.145-.661a.996.996 0 0 0-1.188.142 6.071 6.071 0 0 1-2.384 1.399A1 1 0 0 0 13 18.7l.002 1.3H11v-1.3a1 1 0 0 0-.708-.956 6.083 6.083 0 0 1-2.384-1.399.992.992 0 0 0-1.188-.141l-1.144.662-1-1.729 1.124-.651a1 1 0 0 0 .471-1.108z" />
      <path fill="currentColor" d="M12 16c2.206 0 4-1.794 4-4s-1.794-4-4-4-4 1.794-4 4 1.794 4 4 4zm0-6c1.084 0 2 .916 2 2s-.916 2-2 2-2-.916-2-2 .916-2 2-2z" />
    </svg>
  );
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
    .select('id, status, email, full_name, sectors_interested, investment_range_min_cents, investment_range_max_cents')
    .eq('profile_id', user.id)
    .maybeSingle<LpSettingsRow>();

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
                  <div className="profilesquare">
                    <GearIcon />
                  </div>
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
