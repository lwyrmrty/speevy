import type { Metadata } from 'next';

import { getAccountNdaCeremonyForOnboardingToken } from '@/app/account/nda/actions';
import { AccountNdaCeremony } from '@/components/webflow/account-nda-ceremony';
import { WebflowStyles } from '@/components/webflow/webflow-styles';

export const metadata: Metadata = {
  title: 'Sign your NDA | Speevy',
};

export const dynamic = 'force-dynamic';

// Tokenized account-NDA onboarding step for a just-created pending lead. The
// lead has NO auth session yet, so authorization comes from the signed,
// expiring onboarding token in the URL (resolved to an lp_id server-side). A
// missing account-default template skips gracefully — the lead is still created
// and the page shows a neutral message. See docs/nda-gate-design.md §4B.5.
export default async function OnboardingNdaPage({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string | string[] }>;
}) {
  const resolved = searchParams ? await searchParams : {};
  const token = Array.isArray(resolved.token) ? resolved.token[0] : resolved.token;
  const result = await getAccountNdaCeremonyForOnboardingToken(token);

  return (
    <>
      <WebflowStyles />
      <div className="adminpage-wrapper nopadding">
        <div className="admin-wrapper tall">
          <div className="logincontent">
            <div className="loginblock">
              <div className="loginform-wrapper" style={{ maxWidth: '720px' }}>
                <a href="/" className="w-inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/webflow/images/Harpoon-Logo.png"
                    loading="lazy"
                    sizes="(max-width: 931px) 100vw, 931px"
                    srcSet="/webflow/images/Harpoon-Logo-p-500.png 500w, /webflow/images/Harpoon-Logo-p-800.png 800w, /webflow/images/Harpoon-Logo.png 931w"
                    alt="Harpoon Ventures"
                    className="loginlogo"
                  />
                </a>
                <div className="formblock w-form">
                  <div className="loginform">
                    <div>
                      <div className="loginheader">Review &amp; sign your NDA</div>
                      <div className="loginsubheader">
                        Thanks for requesting access. Please review and sign
                        Harpoon Ventures&#x27; standard NDA below. We&#x27;ll review
                        your information and be in touch after that.
                      </div>
                    </div>
                    <AccountNdaCeremony result={result} variant="onboarding" />
                    <div className="loginsubheader">
                      Already have access? <a href="/login" className="inlinelink">Log in here</a>.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="loginimage-side">
            <div className="loginimage">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/webflow/images/ivan-bandura-5cwigXmGWTo-unsplash.png"
                loading="lazy"
                alt=""
                className="full-image"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
