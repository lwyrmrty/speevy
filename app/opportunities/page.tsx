import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Opportunities | Speevy',
};

// TEMPORARY placeholder for approved LPs. Replaced by the Webflow
// opportunity list + detail pages in a later phase.
export default async function OpportunitiesHomePage() {
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
      <h1 className="text-3xl font-semibold text-ink">Welcome back</h1>
      <p className="text-muted-foreground">
        Signed in as {user.email}. Your opportunities will appear here — the
        investor-facing list and detail pages are not built yet.
      </p>
    </main>
  );
}
