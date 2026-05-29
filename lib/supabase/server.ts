import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { getSupabasePublishableKey, getSupabaseUrl } from '@/lib/supabase/env';

export async function createSupabaseServerClient() {
  const supabaseUrl = getSupabaseUrl();
  const supabaseKey = getSupabasePublishableKey();

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase public environment variables are not configured.');
  }

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot write cookies. Middleware will refresh sessions.
        }
      },
    },
  });
}
