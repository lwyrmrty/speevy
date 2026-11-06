import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  isSafeLoginRedirect,
  LOGIN_SUCCESS_PATHS,
} from '@/lib/auth/login-redirect';

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('login redirect', () => {
  it('only allows the post-login account paths', () => {
    assert.deepEqual([...LOGIN_SUCCESS_PATHS], [
      '/admin',
      '/opportunities',
      '/onboarding',
    ]);
    assert.equal(isSafeLoginRedirect('/admin'), true);
    assert.equal(isSafeLoginRedirect('/opportunities'), true);
    assert.equal(isSafeLoginRedirect('/onboarding'), true);
    assert.equal(isSafeLoginRedirect('/login'), false);
    assert.equal(isSafeLoginRedirect('https://evil.example/admin'), false);
    assert.equal(isSafeLoginRedirect('/admin?next=/'), false);
  });

  it('returns redirectTo from verifyOtp instead of throwing a Next.js redirect', () => {
    const actions = readFileSync(
      path.join(repoRoot, 'app/login/actions.ts'),
      'utf8',
    );

    assert.equal(actions.includes("from 'next/navigation'"), false);
    assert.equal(actions.includes('redirect('), false);
    assert.match(actions, /redirectTo:/);
  });
});
