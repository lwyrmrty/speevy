export type OpportunityStatus = 'potential' | 'upcoming' | 'active' | 'closed';

export type Opportunity = {
  id: string;
  title: string;
  companyName: string;
  teaser: string;
  status: OpportunityStatus;
  minimumInvestmentCents: bigint;
  targetAllocationCents: bigint;
  visibleToAllApprovedLps: boolean;
  ndaRequired: boolean;
  confidence: string;
  sector: string;
  traction: string;
};

export const lpProfile = {
  fullName: 'Avery Chen',
  email: 'avery.chen@example.com',
  status: 'approved',
  accreditationStatus: 'self_attested',
};

export const opportunities: Opportunity[] = [
  {
    id: 'vertex-autonomy',
    title: 'Autonomous Defense Logistics',
    companyName: 'Vertex Autonomy',
    teaser:
      'AI-enabled field logistics platform reducing resupply latency for contested environments.',
    status: 'active',
    minimumInvestmentCents: 100_000_00n,
    targetAllocationCents: 4_500_000_00n,
    visibleToAllApprovedLps: true,
    ndaRequired: true,
    confidence: 'Lead diligence complete',
    sector: 'Defense AI',
    traction: '$3.2M ARR',
  },
  {
    id: 'northstar-fusion',
    title: 'Industrial Fusion Components',
    companyName: 'Northstar Fusion',
    teaser:
      'High-temperature superconducting subsystem provider for private fusion programs.',
    status: 'upcoming',
    minimumInvestmentCents: 250_000_00n,
    targetAllocationCents: 7_000_000_00n,
    visibleToAllApprovedLps: false,
    ndaRequired: false,
    confidence: 'Partner preview',
    sector: 'Frontier Energy',
    traction: '3 design wins',
  },
  {
    id: 'atlas-secure',
    title: 'Zero-Trust Space Comms',
    companyName: 'Atlas Secure',
    teaser:
      'Cryptographic routing layer for resilient satellite and ground-station networks.',
    status: 'potential',
    minimumInvestmentCents: 50_000_00n,
    targetAllocationCents: 2_000_000_00n,
    visibleToAllApprovedLps: true,
    ndaRequired: false,
    confidence: 'Initial screen',
    sector: 'Space Infrastructure',
    traction: 'Pilot LOI',
  },
];

export const activity = [
  'NDA signed for Vertex Autonomy',
  'Interest window opens Friday at 9:00 AM PT',
  'Accreditation self-attestation current',
];
