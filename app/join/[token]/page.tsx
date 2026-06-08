import type { Metadata } from 'next';

import { InvestorRequestForm } from '@/components/auth/investor-request-form';
import { WebflowStyles } from '@/components/webflow/webflow-styles';

type JoinPageProps = {
  params: Promise<{
    token: string;
  }>;
};

export const metadata: Metadata = {
  description: 'Request Harpoon Ventures investor access through Speevy.',
};

export default async function JoinPage({ params }: JoinPageProps) {
  const { token } = await params;

  return (
    <>
      <WebflowStyles />
      <div className="adminpage-wrapper nopadding">
        <div className="admin-wrapper tall">
          <div className="logincontent">
            <div className="loginblock">
              <div className="loginform-wrapper">
                <a href="/join" className="w-inline-block">
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
                  <InvestorRequestForm token={token} />
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
