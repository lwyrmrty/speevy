import type { Metadata } from 'next';
import Link from 'next/link';

import { OtpLoginForm } from '@/components/auth/otp-login-form';
import { SplitAuthShell } from '@/components/auth/split-auth-shell';

export const metadata: Metadata = {
  description: 'Log in to Speevy with a one-time email code.',
};

export default function LoginPage() {
  return (
    <SplitAuthShell
      brand="harpoon"
      eyebrow="Investor login"
      title="Log in to Speevy"
      description="Enter the email address tied to your Harpoon invite. We will send a one-time code to confirm it is you."
      footer={
        <p>
          Need an invite?{' '}
          <Link
            className="font-medium text-harbor underline-offset-4 hover:underline"
            href="/join"
          >
            Request access
          </Link>
          .
        </p>
      }
    >
      <OtpLoginForm flow="login" submitLabel="Send login code" />
    </SplitAuthShell>
  );
}
