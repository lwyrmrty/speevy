import { notFound } from 'next/navigation';

import {
  OpportunityHero,
  OpportunitySection,
} from '@/components/webflow/opportunity-sections';
import { WebflowStyles } from '@/components/webflow/webflow-styles';
import { verifyExportPrintToken } from '@/lib/opportunity/export-token';
import {
  basisPointsToPercent,
  collectSectionStorageKeys,
  compactMinAmount,
  compactRaiseAmount,
  sectionsForExport,
  type OpportunitySectionRow,
} from '@/lib/opportunity/section-data';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export default async function OpportunityExportPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ opportunityId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { opportunityId: slug } = await params;
  const { token } = await searchParams;
  const supabase = createSupabaseAdminClient();

  const { data: opportunity } = await supabase
    .from('opportunities')
    .select(
      `
        id,
        slug,
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
        thumbnail_storage_key,
        logo_storage_key,
        status
      `,
    )
    .eq('slug', slug)
    .is('archived_at', null)
    .maybeSingle();

  if (!opportunity) {
    notFound();
  }

  const verified = verifyExportPrintToken(token, opportunity.id);
  if (!verified) {
    notFound();
  }

  const { data: sections } = await supabase
    .from('opportunity_sections')
    .select('type, position, data')
    .eq('opportunity_id', opportunity.id)
    .order('position', { ascending: true });

  const signedAssetUrl = async (storageKey: string | null) => {
    if (!storageKey) return null;
    const { data } = await supabase.storage
      .from('opportunity-assets')
      .createSignedUrl(storageKey, 60 * 60);
    return data?.signedUrl ?? null;
  };

  const [thumbnailUrl, logoUrl] = await Promise.all([
    signedAssetUrl(opportunity.thumbnail_storage_key),
    signedAssetUrl(opportunity.logo_storage_key),
  ]);

  // jsonb `data` is a section-field map written by the editor.
  const includedSections = sectionsForExport((sections ?? []) as OpportunitySectionRow[]);
  const sectionAssetKeys = collectSectionStorageKeys(includedSections);
  const sectionAssetUrlEntries = await Promise.all(
    sectionAssetKeys.map(async (storageKey) => [
      storageKey,
      await signedAssetUrl(storageKey),
    ] as const),
  );
  const sectionAssetUrls = Object.fromEntries(
    sectionAssetUrlEntries.filter((entry): entry is readonly [string, string] => Boolean(entry[1])),
  );

  return (
    <>
      <WebflowStyles />
      <div className="pagewrapper speevy-opportunity-detail speevy-export-print">
        <div className="pagecontainer">
          <div className="pagemain nogap">
            <OpportunityHero
              opportunity={{
                title: opportunity.title,
                teaser: opportunity.teaser,
                status: opportunity.status,
                sectors: opportunity.opportunity_sectors,
                thumbnailUrl,
                logoUrl,
                websiteUrl: opportunity.website_url,
                linkedinUrl: opportunity.linkedin_url,
                twitterUrl: opportunity.twitter_url,
                raiseLabel: compactRaiseAmount(opportunity.target_allocation_cents),
                originationFeeLabel: compactMinAmount(opportunity.origination_fee_cents),
                carry: basisPointsToPercent(opportunity.carry_percentage_basis_points),
                managementFee: basisPointsToPercent(opportunity.management_fee_basis_points),
                stageLabel: opportunity.stage?.trim() || null,
                minimumLabel: compactMinAmount(opportunity.minimum_investment_cents),
              }}
              thumbnailUrl={thumbnailUrl}
              logoUrl={logoUrl}
              imageLoading="eager"
            />
            {includedSections.map((section) => (
              <OpportunitySection
                key={`${section.type}-${section.position}`}
                section={section}
                assetUrls={sectionAssetUrls}
                watermarkEmail={verified.watermarkText}
                mode="print"
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
