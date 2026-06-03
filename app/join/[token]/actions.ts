'use server';

import { z } from 'zod';

import {
  INVESTMENT_RANGE_MAX,
  INVESTMENT_RANGE_MIN,
  INVESTMENT_RANGE_VALUES,
  INVESTOR_SECTORS,
  formatInvestmentRange,
} from '@/lib/investor-request';
import {
  hasLoopsAdminLpAccessRequestEnv,
  hasLoopsLpSignupReceivedEnv,
  sendAdminLpAccessRequestEmail,
  sendLpSignupReceivedEmail,
} from '@/lib/loops/transactional';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { hasSupabaseServiceRoleEnv } from '@/lib/supabase/env';

export type InvestorRequestActionState = {
  status: 'idle' | 'success' | 'error';
  message: string;
};

const investmentRangeValueSchema = z.coerce
  .number()
  .int()
  .min(INVESTMENT_RANGE_MIN)
  .max(INVESTMENT_RANGE_MAX)
  .refine(
    (value) => (INVESTMENT_RANGE_VALUES as readonly number[]).includes(value),
    'Choose an investment range from the slider.',
  );

const investorRequestSchema = z.object({
  token: z.string().trim().min(1, 'This request link is missing its token.'),
  firstName: z.string().trim().min(1, 'Enter your first name.'),
  lastName: z.string().trim().min(1, 'Enter your last name.'),
  email: z.string().trim().email('Enter a valid email address.'),
  companyName: z.string().trim().min(1, 'Enter your company name.'),
  sectors: z.array(z.enum(INVESTOR_SECTORS)).min(1, 'Select at least one sector.'),
  investmentRangeMin: investmentRangeValueSchema,
  investmentRangeMax: investmentRangeValueSchema,
  accreditedInvestor: z.literal('on', {
    message: 'Confirm that you are an accredited investor.',
  }),
  priorHarpoonInvestor: z.literal('on', {
    message: 'Confirm your prior relationship with Harpoon Ventures.',
  }),
}).refine(
  (request) => request.investmentRangeMin < request.investmentRangeMax,
  {
    path: ['investmentRangeMax'],
    message: 'Choose an investment range with a maximum above the minimum.',
  },
);

function logEmailFailures(label: string, results: PromiseSettledResult<unknown>[]) {
  results.forEach((result) => {
    if (result.status === 'rejected') {
      console.error(`${label} failed:`, result.reason instanceof Error ? result.reason.message : result.reason);
    }
  });
}

export async function submitInvestorRequest(
  _previousState: InvestorRequestActionState,
  formData: FormData,
): Promise<InvestorRequestActionState> {
  const parsed = investorRequestSchema.safeParse({
    token: formData.get('token'),
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    email: formData.get('email'),
    companyName: formData.get('companyName'),
    sectors: formData.getAll('sectors'),
    investmentRangeMin: formData.get('investmentRangeMin'),
    investmentRangeMax: formData.get('investmentRangeMax'),
    accreditedInvestor: formData.get('accreditedInvestor'),
    priorHarpoonInvestor: formData.get('priorHarpoonInvestor'),
  });

  if (!parsed.success) {
    return {
      status: 'error',
      message:
        parsed.error.issues[0]?.message ??
        'Review the request form and try again.',
    };
  }

  const request = parsed.data;
  const fullName = `${request.firstName} ${request.lastName}`;
  const normalizedEmail = request.email.toLowerCase();
  const submittedAt = new Date().toISOString();
  const investmentRange = `${formatInvestmentRange(
    request.investmentRangeMin,
  )} - ${formatInvestmentRange(request.investmentRangeMax)}`;
  const requestNotes = {
    source: 'investor_request_link',
    requestToken: request.token,
    firstName: request.firstName,
    lastName: request.lastName,
    sectorsInterested: request.sectors,
    perOpportunityInvestmentRange: investmentRange,
    accreditedInvestorConfirmed: true,
    priorHarpoonInvestorConfirmed: true,
    submittedAt,
  };

  if (!hasSupabaseServiceRoleEnv()) {
    return {
      status: 'success',
      message:
        'Demo mode: request captured locally. Add Supabase admin credentials to submit it for review.',
    };
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('lps').upsert(
    {
      email: normalizedEmail,
      full_name: fullName,
      entity_name: request.companyName,
      status: 'pending_review',
      accreditation_status: 'self_attested',
      sectors_interested: request.sectors,
      investment_range_min_cents: request.investmentRangeMin * 100,
      investment_range_max_cents: request.investmentRangeMax * 100,
      internal_notes: JSON.stringify(requestNotes, null, 2),
    },
    {
      onConflict: 'email',
    },
  );

  if (error) {
    return {
      status: 'error',
      message:
        'We could not submit this request yet. Please try again or contact investors@harpoon.vc.',
    };
  }

  if (hasLoopsAdminLpAccessRequestEnv()) {
    const { data: admins } = await supabase
      .from('profiles')
      .select('email')
      .eq('role', 'admin');
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://speevy.vc').replace(/\/$/, '');

    const results = await Promise.allSettled(
      (admins ?? []).map((admin) =>
        sendAdminLpAccessRequestEmail({
          adminInvestorsUrl: `${appUrl}/admin/investors`,
          companyName: request.companyName,
          email: admin.email,
          investmentRange,
          investorEmail: normalizedEmail,
          investorName: fullName,
          sectors: request.sectors.join(', '),
          submittedAt,
          idempotencyKey: `lp-access-request-${normalizedEmail}-${admin.email}-${submittedAt}`,
        }),
      ),
    );
    logEmailFailures('Admin LP access request email', results);
  }

  if (hasLoopsLpSignupReceivedEnv()) {
    const results = await Promise.allSettled([
      sendLpSignupReceivedEmail({
        companyName: request.companyName,
        email: normalizedEmail,
        firstName: request.firstName,
        investmentRange,
        investorName: fullName,
        sectors: request.sectors.join(', '),
        submittedAt,
        idempotencyKey: `lp-signup-received-${normalizedEmail}-${submittedAt}`,
      }),
    ]);
    logEmailFailures('LP signup received email', results);
  }

  return {
    status: 'success',
    message:
      'Request submitted. Harpoon Ventures will review your information and follow up directly.',
  };
}
