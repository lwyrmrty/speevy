import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { WebflowStyles } from '@/components/webflow/webflow-styles';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  description: 'Your Harpoon Ventures investor access is being set up.',
};

export default async function OnboardingHomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <>
      <WebflowStyles />
      <div className="adminpage-wrapper nopadding">
        <div className="admin-wrapper tall">
          <div className="logincontent">
            <div className="loginblock">
              <div className="loginform-wrapper">
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
                      <div className="loginheader">Your access is being set up</div>
                      <div className="loginsubheader">
                        Signed in as {user.email}. Your investor profile is under review or
                        onboarding is in progress. We&#x27;ll email you when you&#x27;re approved.
                      </div>
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
                src="/webflow/images/ivan-bandura-5cwigXmGWTo-unsplash.webp"
                loading="lazy"
                sizes="(max-width: 2246px) 100vw, 2246px"
                srcSet="/webflow/images/ivan-bandura-5cwigXmGWTo-unsplash-p-500.webp 500w, /webflow/images/ivan-bandura-5cwigXmGWTo-unsplash-p-800.webp 800w, /webflow/images/ivan-bandura-5cwigXmGWTo-unsplash-p-1080.webp 1080w, /webflow/images/ivan-bandura-5cwigXmGWTo-unsplash-p-1600.webp 1600w, /webflow/images/ivan-bandura-5cwigXmGWTo-unsplash-p-2000.webp 2000w, /webflow/images/ivan-bandura-5cwigXmGWTo-unsplash.webp 2246w"
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
