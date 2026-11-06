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
});
