import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { mapWithConcurrency, withLoopsRetry } from './rate-limited.ts';

describe('mapWithConcurrency', () => {
  it('preserves order and limits peak concurrency', async () => {
    let active = 0;
    let peak = 0;
    const items = Array.from({ length: 12 }, (_, index) => index);

    const results = await mapWithConcurrency(
      items,
      async (item) => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 10));
        active -= 1;
        return item * 2;
      },
      3,
    );

    assert.equal(peak <= 3, true);
    assert.deepEqual(
      results.map((result) => (result.status === 'fulfilled' ? result.value : null)),
      items.map((item) => item * 2),
    );
  });
});

describe('withLoopsRetry', () => {
  it('retries rate-limit errors then succeeds', async () => {
    let attempts = 0;

    const value = await withLoopsRetry(async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new Error('Rate limit exceeded');
      }
      return 'ok';
    }, { baseDelayMs: 1, retries: 4 });

    assert.equal(value, 'ok');
    assert.equal(attempts, 3);
  });

  it('does not retry non-rate-limit errors', async () => {
    let attempts = 0;

    await assert.rejects(
      () => withLoopsRetry(async () => {
        attempts += 1;
        throw new Error('Invalid transactionalId');
      }, { baseDelayMs: 1, retries: 4 }),
      /Invalid transactionalId/,
    );

    assert.equal(attempts, 1);
  });
});
