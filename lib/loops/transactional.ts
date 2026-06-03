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
  sectors: string;
  submittedAt: string;
  idempotencyKey: string;
};

type SendLpApprovedEmailParams = {
  approvedAt: string;
  email: string;
  investorName: string;
  loginUrl: string;
  idempotencyKey: string;
};

function getLoopsApiKey() {
  return process.env.LOOPS_API_KEY;
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
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      transactionalId,
      email,
      dataVariables: {
        companyName,
        firstName,
        investmentRange,
        investorName,
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
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      transactionalId,
      email,
      dataVariables: {
        adminInterestUrl,
        amount,
        indicatedAt,
        investorEmail,
        investorName,
        opportunityTitle,
        opportunityUrl,
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
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      transactionalId,
      email,
      dataVariables: {
        adminInvestorsUrl,
        companyName,
        investmentRange,
        investorEmail,
        investorName,
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

export async function sendLpApprovedEmail({
  approvedAt,
  email,
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
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      transactionalId,
      email,
      dataVariables: {
        approvedAt,
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
