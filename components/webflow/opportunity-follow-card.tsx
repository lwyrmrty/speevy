'use client';

import { useState } from 'react';

import { toggleOpportunityFollow } from '@/app/opportunities/actions';
import { useToast } from '@/components/ui/toast';

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="64"
      height="64"
      className="checkicon"
    >
      <g fill="none" fillRule="evenodd">
        <path
          fill="currentColor"
          d="M21.546 5.111a1.5 1.5 0 0 1 0 2.121L10.303 18.475a1.6 1.6 0 0 1-2.263 0L2.454 12.89a1.5 1.5 0 1 1 2.121-2.121l4.596 4.596L19.424 5.111a1.5 1.5 0 0 1 2.122 0Z"
        />
      </g>
    </svg>
  );
}

export function OpportunityFollowCard({
  following,
  onFollowingChange,
  opportunityId,
}: {
  following: boolean;
  onFollowingChange: (following: boolean) => void;
  opportunityId: string;
}) {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);

  return (
    <div className={`interestwrapper${following ? ' interested' : ''}`}>
      <button
        type="button"
        className={`interestedcheck${following ? ' interested' : ''}`}
        disabled={saving}
        onClick={async () => {
          const nextFollowing = !following;
          setSaving(true);
          onFollowingChange(nextFollowing);

          const result = await toggleOpportunityFollow({
            opportunityId,
            following: nextFollowing,
          });

          setSaving(false);

          if (result.status === 'success') {
            showToast({
              status: 'success',
              text: result.following
                ? 'You will receive updates on this opportunity.'
                : 'You will no longer receive updates on this opportunity.',
            });
            return;
          }

          onFollowingChange(following);
          showToast({ status: 'error', text: result.message });
        }}
      >
        <div>{saving ? 'Saving...' : 'Receive notifications when opp. has updates'}</div>
        <div className="interestchecks-row">
          {following ? (
            <div className="checkboxtoggle checked">
              <CheckIcon />
            </div>
          ) : (
            <div className="checkboxtoggle" />
          )}
        </div>
      </button>
    </div>
  );
}
