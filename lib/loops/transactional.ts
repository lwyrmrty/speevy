import { assertLoopsIdempotencyKey } from '@/lib/loops/idempotency';

type SendLoginCodeEmailParams = {
  email: string;
  loginCode: string;
};

type SendAdminInterestEmailParams = {
  adminInterestUrl: string;
  amount: string;
  email: string;
  indicatedAt: string;
  investorEmail: string;
  investorName: string;
  opportunityTitle: string;
  opportunityUrl: string;
  idempotencyKey: string;
};

type SendAdminLpAccessRequestEmailParams = {
  adminInvestorsUrl: string;
  companyName: string;
  email: string;
  investmentRange: string;
  investorEmail: string;
  investorName: string;
  sectors: string;
  submittedAt: string;
  idempotencyKey: string;
};

type SendLpSignupReceivedEmailParams = {
  companyName: string;
  email: string;
  firstName: string;
  investmentRange: string;
  investorName: string;
  ndaOnboardingUrl: string;
  sectors: string;
  submittedAt: string;
  idempotencyKey: string;
};

type SendLpApprovedEmailParams = {
  approvedAt: string;
  email: string;
  firstName: string;
  investorName: string;
  loginUrl: string;
  idempotencyKey: string;
};

type SendNdaSignedCopyEmailParams = {
  email: string;
  firstName: string;
  ndaName: string;
  signedAt: string;
  // Tokenized Speevy download link (re-issues a fresh signed Storage URL on each
  // click). Never a raw storage key or long-lived public URL.
  downloadUrl: string;
  idempotencyKey: string;
};

type SendLpOpportunityUpdatedEmailParams = {
  email: string;
  firstName: string;
  investorName: string;
  opportunityTitle: string;
  opportunityUrl: string;
  updateCount: string;
  updateHeadline: string;
  updateSummary: string;
  opportunitySectors?: string;
  opportunityRaise?: string;
  opportunityStage?: string;
  opportunityMinimum?: string;
  opportunityTeaser?: string;
  idempotencyKey: string;
};

type OpportunityEmailDetailVariables = {
  opportunityStatus: string;
  opportunityTeaser: string;
  opportunitySectors: string;
  opportunityRaise: string;
  opportunityStage: string;
  opportunityMinimum: string;
};

type SendLpMatchingOpportunityEmailParams = {
  email: string;
  firstName: string;
  investorName: string;
  opportunityTitle: string;
  opportunityUrl: string;
  matchingSectors: string;
  idempotencyKey: string;
} & OpportunityEmailDetailVariables;

type SendLpOpportunityStatusChangedEmailParams = {
  email: string;
  firstName: string;
  investorName: string;
  opportunityTitle: string;
  opportunityUrl: string;
  previousStatus: string;
  newStatus: string;
  statusChangeSummary: string;
  statusChangeKind: string;
  statusChangeCallout: string;
  statusChangeListingMessage: string;
  matchingSectors: string;
  idempotencyKey: string;
} & OpportunityEmailDetailVariables;

function getLoopsApiKey() {
  return process.env.LOOPS_API_KEY;
}

/** Loops data variables must be strings; blank/undefined renders as empty in the template. */
function loopsVar(value: string | number | null | undefined, fallback = '—') {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }

  return fallback;
}

function getLoginCodeTemplateId() {
  return process.env.LOOPS_TEMPLATE_LOGIN_CODE;
}

function getLpSignupReceivedTemplateId() {
  return process.env.LOOPS_TEMPLATE_LP_SIGNUP_RECEIVED;
}

function getAdminInterestTemplateId() {
  return process.env.LOOPS_TEMPLATE_ADMIN_INTEREST_UPDATED;
}

function getAdminLpAccessRequestTemplateId() {
  return process.env.LOOPS_TEMPLATE_ADMIN_LP_ACCESS_REQUEST;
}

function getLpApprovedTemplateId() {
  return process.env.LOOPS_TEMPLATE_LP_APPROVED;
}

function getNdaSignedTemplateId() {
  return process.env.LOOPS_TEMPLATE_NDA_SIGNED;
}

function getLpOpportunityUpdatedTemplateId() {
  return process.env.LOOPS_TEMPLATE_LP_OPPORTUNITY_UPDATED;
}

function getLpMatchingOpportunityTemplateId() {
  return process.env.LOOPS_TEMPLATE_LP_MATCHING_OPPORTUNITY;
}

function getLpOpportunityStatusChangedTemplateId() {
  return process.env.LOOPS_TEMPLATE_LP_OPPORTUNITY_STATUS_CHANGED;
}

export function hasLoopsLoginCodeEnv() {
  return Boolean(getLoopsApiKey() && getLoginCodeTemplateId());
}

export function hasLoopsLpSignupReceivedEnv() {
  return Boolean(getLoopsApiKey() && getLpSignupReceivedTemplateId());
}

export function hasLoopsAdminInterestEnv() {
  return Boolean(getLoopsApiKey() && getAdminInterestTemplateId());
}

export function hasLoopsAdminLpAccessRequestEnv() {
  return Boolean(getLoopsApiKey() && getAdminLpAccessRequestTemplateId());
}

export function hasLoopsLpApprovedEnv() {
  return Boolean(getLoopsApiKey() && getLpApprovedTemplateId());
}

export function hasLoopsNdaSignedEnv() {
  return Boolean(getLoopsApiKey() && getNdaSignedTemplateId());
}

export function hasLoopsLpOpportunityUpdatedEnv() {
  return Boolean(getLoopsApiKey() && getLpOpportunityUpdatedTemplateId());
}

export function hasLoopsLpMatchingOpportunityEnv() {
  return Boolean(getLoopsApiKey() && getLpMatchingOpportunityTemplateId());
}

export function hasLoopsLpOpportunityStatusChangedEnv() {
  return Boolean(getLoopsApiKey() && getLpOpportunityStatusChangedTemplateId());
}

export async function sendLoginCodeEmail({
  email,
  loginCode,
}: SendLoginCodeEmailParams) {
  const apiKey = getLoopsApiKey();
  const transactionalId = getLoginCodeTemplateId();

  if (!apiKey || !transactionalId) {
    throw new Error('Loops login code email environment variables are not configured.');
  }

  const response = await fetch('https://app.loops.so/api/v1/transactional', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      transactionalId,
      email,
      dataVariables: {
        loginCode,
      },
    }),
  });

  if (!response.ok) {
    let message = `Loops transactional email failed with status ${response.status}.`;

    try {
      const body = await response.json();
      if (typeof body?.message === 'string') {
        message = body.message;
      }
    } catch {
      // Keep the status-based message if Loops returns a non-JSON response.
    }

    throw new Error(message);
  }
}

export async function sendLpSignupReceivedEmail({
  companyName,
  email,
  firstName,
  investmentRange,
  investorName,
  ndaOnboardingUrl,
  sectors,
  submittedAt,
  idempotencyKey,
}: SendLpSignupReceivedEmailParams) {
  const apiKey = getLoopsApiKey();
  const transactionalId = getLpSignupReceivedTemplateId();

  if (!apiKey || !transactionalId) {
    throw new Error('Loops LP signup received email environment variables are not configured.');
  }

  const response = await fetch('https://app.loops.so/api/v1/transactional', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': assertLoopsIdempotencyKey(idempotencyKey),
    },
    body: JSON.stringify({
      transactionalId,
      email,
      dataVariables: {
        companyName,
        firstName,
        investmentRange,
        investorName,
        ndaOnboardingUrl,
        sectors,
        submittedAt,
      },
    }),
  });

  if (!response.ok) {
    let message = `Loops transactional email failed with status ${response.status}.`;

    try {
      const body = await response.json();
      if (typeof body?.message === 'string') {
        message = body.message;
      }
    } catch {
      // Keep the status-based message if Loops returns a non-JSON response.
    }

    throw new Error(message);
  }
}

export async function sendAdminInterestEmail({
  adminInterestUrl,
  amount,
  email,
  indicatedAt,
  investorEmail,
  investorName,
  opportunityTitle,
  opportunityUrl,
  idempotencyKey,
}: SendAdminInterestEmailParams) {
  const apiKey = getLoopsApiKey();
  const transactionalId = getAdminInterestTemplateId();

  if (!apiKey || !transactionalId) {
    throw new Error('Loops admin interest email environment variables are not configured.');
  }

  const response = await fetch('https://app.loops.so/api/v1/transactional', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': assertLoopsIdempotencyKey(idempotencyKey),
    },
    body: JSON.stringify({
      transactionalId,
      email,
      // Loops template "LP Interest" declares:
      // investorName, amount, opportunityTitle, adminInterestUrl
      dataVariables: {
        investorName: loopsVar(investorName),
        amount: loopsVar(amount),
        opportunityTitle: loopsVar(opportunityTitle),
        adminInterestUrl: loopsVar(adminInterestUrl, ''),
        indicatedAt: loopsVar(indicatedAt),
        investorEmail: loopsVar(investorEmail),
        opportunityUrl: loopsVar(opportunityUrl, ''),
      },
    }),
  });

  if (!response.ok) {
    let message = `Loops transactional email failed with status ${response.status}.`;

    try {
      const body = await response.json();
      if (typeof body?.message === 'string') {
        message = body.message;
      }
    } catch {
      // Keep the status-based message if Loops returns a non-JSON response.
    }

    throw new Error(message);
  }
}

export async function sendAdminLpAccessRequestEmail({
  adminInvestorsUrl,
  companyName,
  email,
  investmentRange,
  investorEmail,
  investorName,
  sectors,
  submittedAt,
  idempotencyKey,
}: SendAdminLpAccessRequestEmailParams) {
  const apiKey = getLoopsApiKey();
  const transactionalId = getAdminLpAccessRequestTemplateId();

  if (!apiKey || !transactionalId) {
    throw new Error('Loops admin LP access request email environment variables are not configured.');
  }

  const response = await fetch('https://app.loops.so/api/v1/transactional', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': assertLoopsIdempotencyKey(idempotencyKey),
    },
    body: JSON.stringify({
      transactionalId,
      email,
      // Loops template "LP Requests Access" declares: lpName, lpEmail, companyName
      dataVariables: {
        lpName: loopsVar(investorName),
        lpEmail: loopsVar(investorEmail),
        companyName: loopsVar(companyName),
        adminInvestorsUrl: loopsVar(adminInvestorsUrl, ''),
        investmentRange: loopsVar(investmentRange),
        sectors: loopsVar(sectors),
        submittedAt: loopsVar(submittedAt),
      },
    }),
  });

  if (!response.ok) {
    let message = `Loops transactional email failed with status ${response.status}.`;

    try {
      const body = await response.json();
      if (typeof body?.message === 'string') {
        message = body.message;
      }
    } catch {
      // Keep the status-based message if Loops returns a non-JSON response.
    }

    throw new Error(message);
  }
}

export async function sendLpApprovedEmail({
  approvedAt,
  email,
  firstName,
  investorName,
  loginUrl,
  idempotencyKey,
}: SendLpApprovedEmailParams) {
  const apiKey = getLoopsApiKey();
  const transactionalId = getLpApprovedTemplateId();

  if (!apiKey || !transactionalId) {
    throw new Error('Loops LP approved email environment variables are not configured.');
  }

  const response = await fetch('https://app.loops.so/api/v1/transactional', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': assertLoopsIdempotencyKey(idempotencyKey),
    },
    body: JSON.stringify({
      transactionalId,
      email,
      dataVariables: {
        approvedAt,
        firstName,
        investorName,
        loginUrl,
      },
    }),
  });

  if (!response.ok) {
    let message = `Loops transactional email failed with status ${response.status}.`;

    try {
      const body = await response.json();
      if (typeof body?.message === 'string') {
        message = body.message;
      }
    } catch {
      // Keep the status-based message if Loops returns a non-JSON response.
    }

    throw new Error(message);
  }
}

export async function sendLpOpportunityUpdatedEmail({
  email,
  opportunityTitle,
  opportunityUrl,
  updateSummary,
  opportunitySectors = '',
  opportunityRaise = '',
  opportunityStage = '',
  opportunityTeaser = '',
  idempotencyKey,
}: SendLpOpportunityUpdatedEmailParams) {
  const apiKey = getLoopsApiKey();
  const transactionalId = getLpOpportunityUpdatedTemplateId();

  if (!apiKey || !transactionalId) {
    throw new Error('Loops LP opportunity updated email environment variables are not configured.');
  }

  const response = await fetch('https://app.loops.so/api/v1/transactional', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': assertLoopsIdempotencyKey(idempotencyKey),
    },
    body: JSON.stringify({
      transactionalId,
      email,
      // Keep payload aligned with Loops template "Opportunity Update" dataVariables.
      dataVariables: {
        opportunityTitle: loopsVar(opportunityTitle),
        updateSummary: loopsVar(updateSummary),
        opportunityTeaser: loopsVar(opportunityTeaser),
        opportunitySectors: loopsVar(opportunitySectors),
        opportunityStage: loopsVar(opportunityStage),
        opportunityRaise: loopsVar(opportunityRaise),
        opportunityUrl: loopsVar(opportunityUrl, ''),
      },
    }),
  });

  if (!response.ok) {
    let message = `Loops transactional email failed with status ${response.status}.`;

    try {
      const body = await response.json();
      if (typeof body?.message === 'string') {
        message = body.message;
      }
    } catch {
      // Keep the status-based message if Loops returns a non-JSON response.
    }

    throw new Error(message);
  }
}

export async function sendLpOpportunityStatusChangedEmail({
  email,
  opportunityTitle,
  opportunityUrl,
  statusChangeListingMessage,
  opportunityTeaser,
  opportunitySectors,
  opportunityRaise,
  opportunityStage,
  idempotencyKey,
}: SendLpOpportunityStatusChangedEmailParams) {
  const apiKey = getLoopsApiKey();
  const transactionalId = getLpOpportunityStatusChangedTemplateId();

  if (!apiKey || !transactionalId) {
    throw new Error('Loops LP opportunity status changed email environment variables are not configured.');
  }

  const response = await fetch('https://app.loops.so/api/v1/transactional', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': assertLoopsIdempotencyKey(idempotencyKey),
    },
    body: JSON.stringify({
      transactionalId,
      email,
      // Keep payload aligned with Loops template "Opportunity Status Change" dataVariables.
      dataVariables: {
        statusChangeListingMessage: loopsVar(statusChangeListingMessage),
        opportunityTitle: loopsVar(opportunityTitle),
        opportunityTeaser: loopsVar(opportunityTeaser),
        opportunitySectors: loopsVar(opportunitySectors),
        opportunityStage: loopsVar(opportunityStage),
        opportunityRaise: loopsVar(opportunityRaise),
        opportunityUrl: loopsVar(opportunityUrl, ''),
      },
    }),
  });

  if (!response.ok) {
    let message = `Loops transactional email failed with status ${response.status}.`;

    try {
      const body = await response.json();
      if (typeof body?.message === 'string') {
        message = body.message;
      }
    } catch {
      // Keep the status-based message if Loops returns a non-JSON response.
    }

    throw new Error(message);
  }
}

export async function sendLpMatchingOpportunityEmail({
  email,
  opportunityTitle,
  opportunityUrl,
  opportunityStatus,
  opportunityTeaser,
  opportunitySectors,
  opportunityRaise,
  opportunityStage,
  idempotencyKey,
}: SendLpMatchingOpportunityEmailParams) {
  const apiKey = getLoopsApiKey();
  const transactionalId = getLpMatchingOpportunityTemplateId();

  if (!apiKey || !transactionalId) {
    throw new Error('Loops LP matching opportunity email environment variables are not configured.');
  }

  const response = await fetch('https://app.loops.so/api/v1/transactional', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': assertLoopsIdempotencyKey(idempotencyKey),
    },
    body: JSON.stringify({
      transactionalId,
      email,
      // Keep payload aligned with Loops template "New Opportunity Added" dataVariables.
      dataVariables: {
        opportunityTitle: loopsVar(opportunityTitle),
        opportunityTeaser: loopsVar(opportunityTeaser),
        opportunityStatus: loopsVar(opportunityStatus),
        opportunitySectors: loopsVar(opportunitySectors),
        opportunityStage: loopsVar(opportunityStage),
        opportunityRaise: loopsVar(opportunityRaise),
        opportunityUrl: loopsVar(opportunityUrl, ''),
      },
    }),
  });

  if (!response.ok) {
    let message = `Loops transactional email failed with status ${response.status}.`;

    try {
      const body = await response.json();
      if (typeof body?.message === 'string') {
        message = body.message;
      }
    } catch {
      // Keep the status-based message if Loops returns a non-JSON response.
    }

    throw new Error(message);
  }
}

// "Your signed NDA" email. Loops transactional has no attachments wired here, so
// we send a tokenized download LINK (the route re-issues a fresh signed Storage
// URL on each click). The recipient is the signer's own address; do not log it.
export async function sendNdaSignedCopyEmail({
  email,
  firstName,
  ndaName,
  signedAt,
  downloadUrl,
  idempotencyKey,
}: SendNdaSignedCopyEmailParams) {
  const apiKey = getLoopsApiKey();
  const transactionalId = getNdaSignedTemplateId();

  if (!apiKey || !transactionalId) {
    throw new Error('Loops NDA signed copy email environment variables are not configured.');
  }

  const response = await fetch('https://app.loops.so/api/v1/transactional', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': assertLoopsIdempotencyKey(idempotencyKey),
    },
    body: JSON.stringify({
      transactionalId,
      email,
      dataVariables: {
        firstName,
        ndaName,
        signedAt,
        downloadUrl,
      },
    }),
  });

  if (!response.ok) {
    let message = `Loops transactional email failed with status ${response.status}.`;

    try {
      const body = await response.json();
      if (typeof body?.message === 'string') {
        message = body.message;
      }
    } catch {
      // Keep the status-based message if Loops returns a non-JSON response.
    }

    throw new Error(message);
  }
}
