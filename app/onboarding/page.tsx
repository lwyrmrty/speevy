import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Onboarding | Speevy',
};

// TEMPORARY placeholder for invited LPs who have signed in but are not yet
// approved (status: onboarding / pending_review). The real KYC + accreditation
// onboarding flow is a later phase.
export default async function OnboardingHomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-3 px-6">
      <p className="text-sm font-semibold uppercase tracking-widest text-copper">
        Speevy
      </p>
      <h1 className="text-3xl font-semibold text-ink">Your access is being set up</h1>
      <p className="text-muted-foreground">
        Signed in as {user.email}. Your investor profile is under review or
        onboarding is in progress. The KYC and accreditation steps will appear
        here once that flow is built. We&#x27;ll email you when you&#x27;re approved.
      </p>
    </main>
  );
}
