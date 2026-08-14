import { cookies } from 'next/headers';

import { getOutsiderAccountNdaGateState } from '@/app/account/nda/actions';
import {
  opportunityAccessCookieName,
  verifyOpportunityAccessToken,
} from '@/lib/opportunity-access';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const SHAREABLE_STATUSES = ['active', 'potential', 'upcoming', 'closed'];

export type ExportViewer = {
  kind: 'admin' | 'lp' | 'guest';
  email: string;
  profileId: string | null;
  lpId: string | null;
  opportunityId: string;
  slug: string;
  title: string;
};

export type ExportAuthResult =
  | { status: 'ok'; viewer: ExportViewer }
  | { status: 'error'; message: string; httpStatus: number };

export async function authorizeOpportunityExport(slug: string): Promise<ExportAuthResult> {
  const serverSupabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();
  const supabase = createSupabaseAdminClient();

  let isAdmin = false;
  let lp: { id: string; status: string; export_enabled: boolean } | null = null;

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    isAdmin = profile?.role === 'admin';
    const { data: lpRow } = await supabase
      .from('lps')
      .select('id, status, export_enabled')
      .eq('profile_id', user.id)
      .maybeSingle();
    lp = lpRow;
  }

  const { data: opportunity } = await supabase
    .from('opportunities')
    .select('id, slug, title, status, password_protected, nda_required, export_enabled')
    .eq('slug', slug)
    .is('archived_at', null)
    .maybeSingle();

  if (!opportunity) {
    return { status: 'error', message: 'Opportunity not found.', httpStatus: 404 };
  }

  const isShareable = SHAREABLE_STATUSES.includes(opportunity.status);
  const isApprovedLp = lp?.status === 'approved';

  let guestEmail: string | null = null;
  if (opportunity.password_protected && !isAdmin && !isApprovedLp) {
    const cookieStore = await cookies();
    const token = cookieStore.get(opportunityAccessCookieName(opportunity.id))?.value;
    guestEmail = verifyOpportunityAccessToken(token, opportunity.id);
  }

  if (!isAdmin && !opportunity.export_enabled) {
    return { status: 'error', message: 'Export is not enabled for this opportunity.', httpStatus: 403 };
  }

  if (isAdmin) {
    return {
      status: 'ok',
      viewer: {
        kind: 'admin',
        email: user?.email ?? '',
        profileId: user?.id ?? null,
        lpId: lp?.id ?? null,
        opportunityId: opportunity.id,
        slug: opportunity.slug,
        title: opportunity.title,
      },
    };
  }

  if (!isShareable) {
    return { status: 'error', message: 'Opportunity not found.', httpStatus: 404 };
  }

  if (opportunity.password_protected && !isApprovedLp) {
    if (!guestEmail) {
      return { status: 'error', message: 'Unlock this opportunity before exporting.', httpStatus: 401 };
    }

    const ndaGate = await getOutsiderAccountNdaGateState(opportunity.id);
    if (ndaGate.hasAccountTemplate && !ndaGate.signed) {
      return { status: 'error', message: 'Sign the NDA before exporting.', httpStatus: 403 };
    }

    const { data: guestLp } = await supabase
      .from('lps')
      .select('id, export_enabled')
      .eq('email', guestEmail)
      .maybeSingle();

    if (!guestLp?.export_enabled) {
      return { status: 'error', message: 'Export is not enabled for this investor.', httpStatus: 403 };
    }

    return {
      status: 'ok',
      viewer: {
        kind: 'guest',
        email: guestEmail,
        profileId: null,
        lpId: guestLp.id,
        opportunityId: opportunity.id,
        slug: opportunity.slug,
        title: opportunity.title,
      },
    };
  }

  if (!user || !lp || !isApprovedLp) {
    return { status: 'error', message: 'You do not have access to export this opportunity.', httpStatus: 403 };
  }

  if (!lp.export_enabled) {
    return { status: 'error', message: 'Export is not enabled for this investor.', httpStatus: 403 };
  }

  if (opportunity.nda_required) {
    const { data: signedNda } = await supabase
      .from('opportunity_ndas')
      .select('id')
      .eq('opportunity_id', opportunity.id)
      .eq('lp_id', lp.id)
      .eq('status', 'signed')
      .maybeSingle();

    if (!signedNda) {
      return { status: 'error', message: 'Sign the NDA before exporting.', httpStatus: 403 };
    }
  }

  return {
    status: 'ok',
    viewer: {
      kind: 'lp',
      email: user.email ?? '',
      profileId: user.id,
      lpId: lp.id,
      opportunityId: opportunity.id,
      slug: opportunity.slug,
      title: opportunity.title,
    },
  };
}
