import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const source = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'webflow-login-form.tsx'),
  'utf8',
);

describe('WebflowLoginForm', () => {
  it('does not use a React server-action form action that iOS Safari can throw', () => {
    assert.equal(source.includes('action={sendAction}'), false);
    assert.equal(source.includes('action={verifyAction}'), false);
    assert.match(source, /onSubmit=\{handleSendSubmit\}/);
    assert.match(source, /onSubmit=\{handleVerifySubmit\}/);
  });

  it('attaches the Turnstile token at submit time instead of trusting a stale hidden input', () => {
    assert.match(source, /attachTurnstileToken\(formData, emailTurnstileRef/);
    assert.match(source, /attachTurnstileToken\(formData, codeTurnstileRef/);
    assert.match(source, /shouldResetTurnstile\(result\.message\)/);
  });

  it('keeps Go to account tappable and spreads an autofilled code', () => {
    assert.equal(source.includes('code.length < CODE_LENGTH'), false);
    assert.match(source, /fillCodeDigits/);
    assert.match(source, /maxLength=\{index === 0 \? CODE_LENGTH : 1\}/);
    assert.match(source, /readEnteredCode/);
    assert.match(source, /type="button"/);
    assert.match(source, /onClick=\{submitVerification\}/);
    assert.match(source, /followLoginRedirect/);
  });
});
