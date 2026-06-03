import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  hasLoopsLpApprovedEnv,
  sendLpApprovedEmail,
} from '@/lib/loops/transactional';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const bulkApproveSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

async function getAdminUserId() {
  const serverSupabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) return null;

  const supabase = createSupabaseAdminClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  return profile?.role === 'admin' ? user.id : null;
}

export async function POST(request: Request) {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) {
    return NextResponse.json({ message: 'Only admins can approve investors.' }, { status: 403 });
  }

  const parsed = bulkApproveSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: 'Select at least one valid investor to approve.' }, { status: 400 });
  }

  const ids = Array.from(new Set(parsed.data.ids));
  const supabase = createSupabaseAdminClient();
  const { data: investors, error: fetchError } = await supabase
    .from('lps')
    .select('id, email, full_name, status')
    .in('id', ids);

  if (fetchError) {
    return NextResponse.json({ message: fetchError.message }, { status: 500 });
  }

  if ((investors ?? []).length !== ids.length) {
    return NextResponse.json({ message: 'One or more selected investors could not be found.' }, { status: 404 });
  }

  if (!(investors ?? []).every((investor) => investor.status === 'pending_review')) {
    return NextResponse.json(
      { message: 'Only investors pending review can be bulk approved.' },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('lps')
    .update({
      status: 'approved',
      approved_at: now,
      approved_by_profile_id: adminUserId,
      updated_at: now,
    })
    .in('id', ids);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  if (hasLoopsLpApprovedEnv()) {
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://speevy.vc').replace(/\/$/, '');
    await Promise.allSettled(
      (investors ?? []).map((investor) =>
        sendLpApprovedEmail({
          approvedAt: now,
          email: investor.email,
          investorName: investor.full_name || investor.email,
          loginUrl: `${appUrl}/login`,
          idempotencyKey: `lp-approved-${investor.id}-${now}`,
        }),
      ),
    );
  }

  return NextResponse.json({ message: `${ids.length} investors approved.` });
}
