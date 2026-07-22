import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  LOOPS_IDEMPOTENCY_KEY_MAX_LENGTH,
  assertLoopsIdempotencyKey,
  buildLoopsIdempotencyKey,
} from './idempotency';

const LONG_EMAIL =
  'very.long.investor.name.with.many.segments@subdomain.corporation-example.com';
const UUID = '123e4567-e89b-12d3-a456-426614174000';
const ISO_TIMESTAMP = '2026-07-22T22:11:45.123Z';

describe('buildLoopsIdempotencyKey', () => {
  it('stays under 100 chars for worst-case status-change fan-out parts', () => {
    const key = buildLoopsIdempotencyKey(
      'lp-opportunity-status-changed',
      UUID,
      LONG_EMAIL,
      'potential',
      'active',
      ISO_TIMESTAMP,
    );

    assert.equal(key.length < LOOPS_IDEMPOTENCY_KEY_MAX_LENGTH, true);
    assert.equal(key.startsWith('lp-opportunity-status-changed-'), true);
    assert.equal(key.length, 'lp-opportunity-status-changed-'.length + 32);
  });

  it('stays under 100 chars for other fan-out prefixes with long emails', () => {
    const cases = [
      buildLoopsIdempotencyKey('lp-matching-opportunity', UUID, LONG_EMAIL, ISO_TIMESTAMP),
      buildLoopsIdempotencyKey('lp-opportunity-updated', UUID, LONG_EMAIL, ISO_TIMESTAMP),
      buildLoopsIdempotencyKey('follow-update', UUID, LONG_EMAIL),
      buildLoopsIdempotencyKey('lp-access-request', LONG_EMAIL, LONG_EMAIL, ISO_TIMESTAMP),
      buildLoopsIdempotencyKey('lp-signup-received', LONG_EMAIL, ISO_TIMESTAMP),
      buildLoopsIdempotencyKey('interest', UUID, LONG_EMAIL, ISO_TIMESTAMP),
      buildLoopsIdempotencyKey('lp-approved', UUID, ISO_TIMESTAMP),
      buildLoopsIdempotencyKey('nda-signed-copy', 'opportunity', UUID),
    ];

    for (const key of cases) {
      assert.equal(key.length < LOOPS_IDEMPOTENCY_KEY_MAX_LENGTH, true);
    }
  });

  it('is stable for identical parts and unique when savedAt changes', () => {
    const first = buildLoopsIdempotencyKey(
      'lp-opportunity-status-changed',
      UUID,
      LONG_EMAIL,
      'potential',
      'active',
      ISO_TIMESTAMP,
    );
    const retry = buildLoopsIdempotencyKey(
      'lp-opportunity-status-changed',
      UUID,
      LONG_EMAIL,
      'potential',
      'active',
      ISO_TIMESTAMP,
    );
    const retrigger = buildLoopsIdempotencyKey(
      'lp-opportunity-status-changed',
      UUID,
      LONG_EMAIL,
      'potential',
      'active',
      '2026-07-22T23:00:00.000Z',
    );

    assert.equal(first, retry);
    assert.notEqual(first, retrigger);
  });

  it('rejects keys that already exceed the Loops limit', () => {
    const tooLong = 'x'.repeat(LOOPS_IDEMPOTENCY_KEY_MAX_LENGTH + 1);
    assert.throws(() => assertLoopsIdempotencyKey(tooLong), /exceeds 100 characters/);
  });
});
