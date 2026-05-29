import type { Metadata } from 'next';
import Link from 'next/link';

import { InvestorRequestForm } from '@/components/auth/investor-request-form';
import { SplitAuthShell } from '@/components/auth/split-auth-shell';

type JoinPageProps = {
  params: Promise<{
    token: string;
  }>;
};

export const metadata: Metadata = {
  title: 'Request investor access | Speevy',
  description: 'Request Harpoon Ventures investor access through Speevy.',
};

export default async function JoinPage({ params }: JoinPageProps) {
  const { token } = await params;

  return (
    <SplitAuthShell
      eyebrow="Investor request"
      title="Request Speevy access"
      description="Use this private Harpoon Ventures link to share your investor profile for review. This is separate from accepting a direct SPV invite."
      footer={
        <p>
          Already approved?{' '}
          <Link
            className="font-medium text-harbor underline-offset-4 hover:underline"
            href="/login"
          >
            Log in instead
          </Link>
          .
        </p>
      }
    >
      <InvestorRequestForm token={token} />
    </SplitAuthShell>
  );
}
