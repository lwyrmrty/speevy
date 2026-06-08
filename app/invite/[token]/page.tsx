import type { Metadata } from 'next';
import Link from 'next/link';

import { OtpLoginForm } from '@/components/auth/otp-login-form';
import { SplitAuthShell } from '@/components/auth/split-auth-shell';

type InvitePageProps = {
  params: Promise<{
    token: string;
  }>;
  searchParams: Promise<{
    email?: string;
  }>;
};

export const metadata: Metadata = {
  description: 'Accept your Speevy invite with a one-time email code.',
};

export default async function InvitePage({ searchParams }: InvitePageProps) {
  const { email } = await searchParams;
  const safeEmail = typeof email === 'string' ? email : '';

  return (
    <SplitAuthShell
      eyebrow="Invite link"
      title="Accept your Speevy invite"
      description="Use the email address that received this invite. We will send a one-time code to confirm access before onboarding."
      footer={
        <p>
          Already accepted your invite?{' '}
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
      <div className="mb-5 rounded-2xl border border-copper/20 bg-copper/10 px-4 py-3 text-sm leading-6 text-slate-700">
        This invite link is private to you. Confirm the email address that
        received the invite to continue into onboarding.
      </div>

      <OtpLoginForm
        flow="invite"
        initialEmail={safeEmail}
        emailLocked={Boolean(safeEmail)}
        submitLabel="Send invite code"
      />
    </SplitAuthShell>
  );
}
