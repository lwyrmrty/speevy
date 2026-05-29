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
        stage,
        target_allocation_cents,
        minimum_investment_cents,
        carry_percentage_basis_points,
        management_fee_basis_points,
        nda_required,
        watermark_enabled,
        password_protected,
        thumbnail_storage_key,
        logo_storage_key
      `,
    )
    .eq('slug', opportunityId)
    .maybeSingle();

  const { data: sections } = opportunity?.id
    ? await supabase
        .from('opportunity_sections')
        .select('type, position, data')
        .eq('opportunity_id', opportunity.id)
        .order('position', { ascending: true })
    : { data: [] };

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
    opportunity: opportunity
      ? {
          status: opportunity.status,
          title: opportunity.title,
          teaser: opportunity.teaser,
          stage: opportunity.stage,
          targetAllocationCents: opportunity.target_allocation_cents,
          minimumInvestmentCents: opportunity.minimum_investment_cents,
          carryPercentageBasisPoints: opportunity.carry_percentage_basis_points,
          managementFeeBasisPoints: opportunity.management_fee_basis_points,
          ndaRequired: opportunity.nda_required,
          watermarkEnabled: opportunity.watermark_enabled,
          passwordProtected: opportunity.password_protected,
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
