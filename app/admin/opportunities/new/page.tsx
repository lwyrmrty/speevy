import type { Metadata } from 'next';

import { OpportunityEditor } from '@/components/webflow/opportunity-editor';

export const metadata: Metadata = {
  title: 'Create Opportunity | Speevy',
};

export default function NewOpportunityPage() {
  return (
    <OpportunityEditor
      initialData={{
        slug: 'new',
        createNew: true,
        opportunity: null,
        sections: [],
      }}
    />
  );
}
