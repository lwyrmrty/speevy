import { OpportunityEditor } from '@/components/webflow/opportunity-editor';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

// Opportunity saves can fan out Loops emails to every approved LP.
export const maxDuration = 60;

export default async function NewOpportunityPage() {
  const supabase = createSupabaseAdminClient();
  const { data: ndaTemplatesData } = await supabase
    .from('nda_templates')
    .select('id, name')
    .is('archived_at', null)
    .order('created_at', { ascending: false });

  return (
    <OpportunityEditor
      initialData={{
        slug: 'new',
        createNew: true,
        opportunity: null,
        sections: [],
        ndaTemplates: ndaTemplatesData ?? [],
      }}
    />
  );
}
