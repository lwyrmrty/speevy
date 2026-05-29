import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Admin | Speevy',
};

// TEMPORARY placeholder. Replaced by the Webflow admin pages
// (opportunities list, manage investors, etc.) in a later phase.
export default async function AdminHomePage() {
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
        Speevy Admin
      </p>
      <h1 className="text-3xl font-semibold text-ink">You&#x27;re signed in as an admin</h1>
      <p className="text-muted-foreground">
        Signed in as {user.email}. The admin dashboard (opportunities, investor
        management) is not built yet — this is a placeholder landing page.
      </p>
    </main>
  );
}
