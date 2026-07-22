import { NextResponse } from 'next/server';
import { z } from 'zod';

import { logLpEmailSent } from '@/lib/admin/log-lp-email-sent';
import { buildAppUrl } from '@/lib/app-url';
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
    const results = await Promise.allSettled(
      (investors ?? []).map(async (investor) => {
        const idempotencyKey = `lp-approved-${investor.id}-${now}`;

        await sendLpApprovedEmail({
          approvedAt: now,
          email: investor.email,
          firstName: investor.full_name?.trim().split(/\s+/)[0] || investor.email,
          investorName: investor.full_name || investor.email,
          loginUrl: buildAppUrl('/login'),
          idempotencyKey,
        });

        await logLpEmailSent({
          lpId: investor.id,
          template: 'approved',
          idempotencyKey,
        });
      }),
    );
    results.forEach((result) => {
      if (result.status === 'rejected') {
        console.error(
          'LP approved email failed:',
          result.reason instanceof Error ? result.reason.message : result.reason,
        );
      }
    });
  }

  return NextResponse.json({ message: `${ids.length} investors approved.` });
}
