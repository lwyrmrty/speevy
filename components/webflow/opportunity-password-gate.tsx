'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { unlockOpportunity } from '@/app/opportunities/actions';

export function OpportunityPasswordGate({
  slug,
  title,
  teaser,
}: {
  slug: string;
  title: string;
  teaser: string | null;
}) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    const result = await unlockOpportunity({ slug, password, email });

    if (result.status === 'success') {
      router.refresh();
      return;
    }

    setSubmitting(false);
    setError(result.message);
  }

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
              <div className="formblock w-form">
                <form className="loginform" onSubmit={handleSubmit}>
                  <div>
                    <div className="loginheader">{title}</div>
                    <div className="loginsubheader">
                      {teaser
                        ? teaser
                        : 'This opportunity is password protected.'}{' '}
                      Enter the password you were given and your email to view it.
                    </div>
                  </div>
                  <div className="fieldblock">
                    <label htmlFor="opportunity-password" className="fieldlabel">
                      Password
                    </label>
                    <input
                      className="textfield w-input"
                      maxLength={256}
                      name="password"
                      id="opportunity-password"
                      type="password"
                      autoComplete="off"
                      value={password}
                      onChange={(event) => setPassword(event.currentTarget.value)}
                      required
                    />
                  </div>
                  <div className="fieldblock">
                    <label htmlFor="opportunity-email" className="fieldlabel">
                      Email
                    </label>
                    <input
                      className="textfield w-input"
                      maxLength={256}
                      name="email"
                      id="opportunity-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.currentTarget.value)}
                      required
                    />
                  </div>
                  <input
                    type="submit"
                    className="button w-button"
                    value={submitting ? 'Please wait…' : 'View Opportunity'}
                    disabled={submitting}
                  />
                </form>
                {error ? (
                  <div className="loginsubheader" style={{ color: '#b42318' }}>
                    {error}
                  </div>
                ) : null}
                <div className="loginsubheader">
                  Already an investor with us?{' '}
                  <a href="/login" className="inlinelink">
                    Sign in
                  </a>
                  .
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
  );
}
