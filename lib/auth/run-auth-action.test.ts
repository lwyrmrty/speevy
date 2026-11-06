import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { runAuthAction } from './run-auth-action';

type State = {
  status: 'idle' | 'success' | 'error';
  message: string;
  email?: string;
};

const previous: State = { status: 'idle', message: '' };

describe('runAuthAction', () => {
  it('returns the action result', async () => {
    const result = await runAuthAction<State>(
      async () => ({ status: 'success', message: 'sent', email: 'a@b.com' }),
      previous,
      new FormData(),
    );

    assert.deepEqual(result, {
      status: 'success',
      message: 'sent',
      email: 'a@b.com',
    });
  });

  it('turns a protocol failure into a form error instead of throwing', async () => {
    const result = await runAuthAction<State>(
      async () => {
        throw new Error('An unexpected response was received from the server.');
      },
      previous,
      new FormData(),
    );

    assert.equal(result.status, 'error');
    assert.match(result.message, /Could not reach the server/);
  });

  it('rethrows Next.js redirects so login can leave the page', async () => {
    const redirect = Object.assign(new Error('NEXT_REDIRECT'), {
      digest: 'NEXT_REDIRECT;replace;/admin;307;',
    });

    await assert.rejects(
      () =>
        runAuthAction<State>(
          async () => {
            throw redirect;
          },
          previous,
          new FormData(),
        ),
      redirect,
    );
  });
});
