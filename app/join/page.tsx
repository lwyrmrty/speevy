import type { Metadata } from 'next';

import { InvestorRequestForm } from '@/components/auth/investor-request-form';
import { SplitAuthShell } from '@/components/auth/split-auth-shell';
import { WebflowStyles } from '@/components/webflow/webflow-styles';

export const metadata: Metadata = {
  description: 'Request Harpoon Ventures investor access through Speevy.',
};

export default function JoinPage() {
  return (
    <>
      <WebflowStyles />
      <SplitAuthShell
        brand="harpoon"
        eyebrow="Investor access"
        title="Request Harpoon access"
        description="Tell us a bit about yourself and the sectors you care about. Harpoon reviews every request before inviting LPs into Speevy."
      >
        <div className="speevy-join-form-shell">
          <InvestorRequestForm token="public" />
        </div>
      </SplitAuthShell>
    </>
  );
}
