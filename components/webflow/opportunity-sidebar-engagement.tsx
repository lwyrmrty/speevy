'use client';

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { OpportunityFollowCard } from '@/components/webflow/opportunity-follow-card';
import { OpportunityInterestCard } from '@/components/webflow/opportunity-interest-card';

type OpportunityEngagementContextValue = {
  following: boolean;
  initialAmountCents: number | null;
  initialInterested: boolean;
  minimumInvestmentCents: number;
  opportunityId: string;
  setFollowing: (following: boolean) => void;
  variant: 'standard' | 'closed';
};

const OpportunityEngagementContext =
  createContext<OpportunityEngagementContextValue | null>(null);

function useOpportunityEngagement() {
  const context = useContext(OpportunityEngagementContext);

  if (!context) {
    throw new Error('Opportunity engagement components must be used within OpportunityEngagementProvider.');
  }

  return context;
}

export function OpportunityEngagementProvider({
  children,
  initialAmountCents = null,
  initialFollowing = false,
  initialInterested = false,
  minimumInvestmentCents,
  opportunityId,
  variant = 'standard',
}: {
  children: ReactNode;
  initialAmountCents?: number | null;
  initialFollowing?: boolean;
  initialInterested?: boolean;
  minimumInvestmentCents: number;
  opportunityId: string;
  variant?: 'standard' | 'closed';
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const value = useMemo(
    () => ({
      following,
      initialAmountCents,
      initialInterested,
      minimumInvestmentCents,
      opportunityId,
      setFollowing,
      variant,
    }),
    [
      following,
      initialAmountCents,
      initialInterested,
      minimumInvestmentCents,
      opportunityId,
      variant,
    ],
  );

  return (
    <OpportunityEngagementContext.Provider value={value}>
      {children}
    </OpportunityEngagementContext.Provider>
  );
}

export function OpportunityReserveInterestSection() {
  const {
    initialAmountCents,
    initialInterested,
    minimumInvestmentCents,
    opportunityId,
    setFollowing,
    variant,
  } = useOpportunityEngagement();

  return (
    <div className="cardblock reserve-interest-cardblock">
      <div>
        <div className="sideheading">
          {variant === 'closed' ? 'Interested?' : 'Reserve Interest'}
        </div>
        <div className="sidesubheading">
          {variant === 'closed'
            ? 'Let us know if you would like updates if this opportunity becomes available again.'
            : 'Let us know your interest in the opportunity to reserve allocation'}
        </div>
      </div>
      <div className="formblock w-form">
        <OpportunityInterestCard
          initialAmountCents={initialAmountCents}
          initialInterested={initialInterested}
          minimumInvestmentCents={minimumInvestmentCents}
          opportunityId={opportunityId}
          variant={variant}
          onInterestSaved={({ following: nextFollowing }) => {
            if (nextFollowing) {
              setFollowing(true);
            }
          }}
        />
      </div>
    </div>
  );
}

export function OpportunityFollowSection() {
  const { following, opportunityId, setFollowing } = useOpportunityEngagement();

  return (
    <div className="cardblock follow-opportunity-cardblock">
      <div className="formblock w-form">
        <OpportunityFollowCard
          following={following}
          onFollowingChange={setFollowing}
          opportunityId={opportunityId}
        />
      </div>
    </div>
  );
}
