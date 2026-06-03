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

function getLoopsApiKey() {
  return process.env.LOOPS_API_KEY;
}

function getLoginCodeTemplateId() {
  return process.env.LOOPS_TEMPLATE_LOGIN_CODE;
}

function getAdminInterestTemplateId() {
  return process.env.LOOPS_TEMPLATE_ADMIN_INTEREST_UPDATED;
}

export function hasLoopsLoginCodeEnv() {
  return Boolean(getLoopsApiKey() && getLoginCodeTemplateId());
}

export function hasLoopsAdminInterestEnv() {
  return Boolean(getLoopsApiKey() && getAdminInterestTemplateId());
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
