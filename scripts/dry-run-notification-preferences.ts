import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { createClient } from '@supabase/supabase-js';

import {
  shouldIncludeLpForNewOpportunityBroadcast,
  shouldIncludeLpForStatusChangeBroadcast,
} from '@/lib/opportunity/broadcast-recipient-selection';

const FOCUS_EMAIL = 'mat@harpoon.vc';

function loadEnvFile(filePath: string) {
  const text = readFileSync(filePath, 'utf8');

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(resolve(process.cwd(), '.env.local'));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase env vars in .env.local');
  process.exit(1);
}

type LpRow = {
  email: string;
  full_name: string | null;
  sectors_interested: unknown;
  new_opportunity_notification_preference: string | null;
  active_opportunity_notification_preference: string | null;
};

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const sampleOpportunity = {
  title: 'Aalo Atomics',
  sectors: ['Energy'],
};

function countRecipients(
  lps: LpRow[],
  predicate: (lp: LpRow) => boolean,
) {
  const included = lps.filter(predicate);
  return {
    total: included.length,
    includesFocus: included.some((lp) => lp.email === FOCUS_EMAIL),
  };
}

function printScenario(label: string, result: { total: number; includesFocus: boolean }) {
  console.log(`- ${label}: ${result.total} recipient(s), ${FOCUS_EMAIL} ${result.includesFocus ? 'included' : 'excluded'}`);
}

function simulateMatPreferenceMatrix(baseLp: LpRow) {
  console.log('\nSimulated preference matrix for mat@harpoon.vc only (no emails sent):');

  const scenarios = [
    {
      label: 'New opportunity / always',
      include: shouldIncludeLpForNewOpportunityBroadcast(
        { ...baseLp, new_opportunity_notification_preference: 'always' },
        sampleOpportunity.sectors,
      ),
    },
    {
      label: 'New opportunity / sector_match (Energy opp, Mat has AI+Aerospace+Defense)',
      include: shouldIncludeLpForNewOpportunityBroadcast(
        { ...baseLp, new_opportunity_notification_preference: 'sector_match' },
        sampleOpportunity.sectors,
      ),
    },
    {
      label: 'New opportunity / never',
      include: shouldIncludeLpForNewOpportunityBroadcast(
        { ...baseLp, new_opportunity_notification_preference: 'never' },
        sampleOpportunity.sectors,
      ),
    },
    {
      label: 'Status → Active / always',
      include: shouldIncludeLpForStatusChangeBroadcast(
        { ...baseLp, active_opportunity_notification_preference: 'always' },
        sampleOpportunity.sectors,
        'active',
      ),
    },
    {
      label: 'Status → Active / sector_match',
      include: shouldIncludeLpForStatusChangeBroadcast(
        { ...baseLp, active_opportunity_notification_preference: 'sector_match' },
        sampleOpportunity.sectors,
        'active',
      ),
    },
    {
      label: 'Status → Active / never',
      include: shouldIncludeLpForStatusChangeBroadcast(
        { ...baseLp, active_opportunity_notification_preference: 'never' },
        sampleOpportunity.sectors,
        'active',
      ),
    },
    {
      label: 'Status → Upcoming / never',
      include: shouldIncludeLpForStatusChangeBroadcast(
        { ...baseLp, active_opportunity_notification_preference: 'never' },
        sampleOpportunity.sectors,
        'upcoming',
      ),
    },
  ];

  for (const scenario of scenarios) {
    console.log(`  • ${scenario.label}: ${scenario.include ? 'would notify' : 'would skip'}`);
  }
}

async function main() {
  const { data: lps, error } = await supabase
    .from('lps')
    .select('email, full_name, sectors_interested, new_opportunity_notification_preference, active_opportunity_notification_preference')
    .eq('status', 'approved');

  if (error) {
    console.error('Failed to load approved LPs:', error.message);
    process.exit(1);
  }

  const approvedLps = (lps ?? []) as LpRow[];
  const focusLp = approvedLps.find((lp) => lp.email === FOCUS_EMAIL);

  console.log('Notification preference dry run (no emails sent)');
  console.log(`Sample opportunity: ${sampleOpportunity.title} [${sampleOpportunity.sectors.join(', ')}]`);
  console.log(`Approved LPs in database: ${approvedLps.length}`);

  if (focusLp) {
    console.log(`\nStored preferences for ${FOCUS_EMAIL}:`);
    console.log(`  new_opportunity_notification_preference: ${focusLp.new_opportunity_notification_preference ?? 'always (default)'}`);
    console.log(`  active_opportunity_notification_preference: ${focusLp.active_opportunity_notification_preference ?? 'always (default)'}`);
    console.log(`  sectors_interested: ${JSON.stringify(focusLp.sectors_interested)}`);
  }

  console.log('\nBroadcast recipient counts with stored DB preferences:');
  printScenario(
    'New opportunity published',
    countRecipients(approvedLps, (lp) =>
      shouldIncludeLpForNewOpportunityBroadcast(lp, sampleOpportunity.sectors)),
  );
  printScenario(
    'Status change → Upcoming',
    countRecipients(approvedLps, (lp) =>
      shouldIncludeLpForStatusChangeBroadcast(lp, sampleOpportunity.sectors, 'upcoming')),
  );
  printScenario(
    'Status change → Active',
    countRecipients(approvedLps, (lp) =>
      shouldIncludeLpForStatusChangeBroadcast(lp, sampleOpportunity.sectors, 'active')),
  );

  if (focusLp) {
    simulateMatPreferenceMatrix(focusLp);
  } else {
    console.log(`\n${FOCUS_EMAIL} not found among approved LPs; skipped focus simulation.`);
  }

  console.log('\nDone.');
}

void main();
