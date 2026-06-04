import type { Metadata } from 'next';

import {
  OpportunityEditor,
  type OpportunityEditorInitialData,
} from '@/components/webflow/opportunity-editor';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const metadata: Metadata = {
  title: 'Edit Opportunity | Speevy',
};

export default async function EditOpportunityPage({
  params,
}: {
  params: Promise<{ opportunityId: string }>;
}) {
  const { opportunityId } = await params;
  const supabase = createSupabaseAdminClient();
  const { data: opportunity } = await supabase
    .from('opportunities')
    .select(
      `
        id,
        status,
        title,
        teaser,
        opportunity_sectors,
        stage,
        target_allocation_cents,
        minimum_investment_cents,
        origination_fee_cents,
        carry_percentage_basis_points,
        management_fee_basis_points,
        website_url,
        linkedin_url,
        twitter_url,
        nda_required,
        nda_template_id,
        watermark_enabled,
        password_protected,
        thumbnail_storage_key,
        logo_storage_key
      `,
    )
    .eq('slug', opportunityId)
    .maybeSingle();

  const { data: ndaTemplatesData } = await supabase
    .from('nda_templates')
    .select('id, name')
    .is('archived_at', null)
    .order('created_at', { ascending: false });

  const { data: sections } = opportunity?.id
    ? await supabase
        .from('opportunity_sections')
        .select('type, position, data')
        .eq('opportunity_id', opportunity.id)
        .order('position', { ascending: true })
    : { data: [] };

  // Read the actual gate password via the service-role client (admin-only route)
  // so the editor can show and reveal it. It lives in its own LP-inaccessible
  // table; it is never included in any LP-facing opportunity query.
  const { data: accessPassword } = opportunity?.id
    ? await supabase
        .from('opportunity_access_passwords')
        .select('password')
        .eq('opportunity_id', opportunity.id)
        .maybeSingle()
    : { data: null };

  const getSignedAssetUrl = async (storageKey: string | null) => {
    if (!storageKey) {
      return null;
    }

    const { data } = await supabase.storage
      .from('opportunity-assets')
      .createSignedUrl(storageKey, 60 * 60);

    return data?.signedUrl ?? null;
  };

  const [thumbnailUrl, logoUrl] = await Promise.all([
    getSignedAssetUrl(opportunity?.thumbnail_storage_key ?? null),
    getSignedAssetUrl(opportunity?.logo_storage_key ?? null),
  ]);

  const initialData: OpportunityEditorInitialData = {
    slug: opportunityId,
    ndaTemplates: ndaTemplatesData ?? [],
    opportunity: opportunity
      ? {
          status: opportunity.status,
          title: opportunity.title,
          teaser: opportunity.teaser,
          sectors: opportunity.opportunity_sectors,
          stage: opportunity.stage,
          targetAllocationCents: opportunity.target_allocation_cents,
          minimumInvestmentCents: opportunity.minimum_investment_cents,
          originationFeeCents: opportunity.origination_fee_cents,
          carryPercentageBasisPoints: opportunity.carry_percentage_basis_points,
          managementFeeBasisPoints: opportunity.management_fee_basis_points,
          websiteUrl: opportunity.website_url,
          linkedinUrl: opportunity.linkedin_url,
          twitterUrl: opportunity.twitter_url,
          ndaRequired: opportunity.nda_required,
          ndaTemplateId: opportunity.nda_template_id,
          watermarkEnabled: opportunity.watermark_enabled,
          passwordProtected: opportunity.password_protected,
          // The actual gate password (plaintext) so the admin can view/reveal it.
          password: accessPassword?.password ?? null,
          thumbnailStorageKey: opportunity.thumbnail_storage_key,
          logoStorageKey: opportunity.logo_storage_key,
          thumbnailUrl,
          logoUrl,
        }
      : null,
    sections: sections ?? [],
  };

  return <OpportunityEditor initialData={initialData} />;
}
