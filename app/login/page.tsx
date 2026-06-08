import type { Metadata } from 'next';

import { WebflowLoginForm } from '@/components/auth/webflow-login-form';

export const metadata: Metadata = {
  description: 'Log in to Speevy with a one-time email code.',
};

export default function LoginPage() {
  return (
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
              <WebflowLoginForm />
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
  );
}
