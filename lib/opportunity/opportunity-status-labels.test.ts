import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  formatComingSoonListingMessage,
  formatStatusChangeListingMessage,
  shouldNotifyComingSoonFlip,
} from '@/lib/opportunity/opportunity-status-labels';

describe('formatComingSoonListingMessage', () => {
  it('uses the agreed Coming Soon listing copy', () => {
    assert.equal(
      formatComingSoonListingMessage('Aalo'),
      'Aalo is now marked as Coming Soon, and may be opening for allocation soon.',
    );
  });

  it('falls back when title is blank', () => {
    assert.equal(
      formatComingSoonListingMessage('   '),
      'This opportunity is now marked as Coming Soon, and may be opening for allocation soon.',
    );
  });
});

describe('formatStatusChangeListingMessage', () => {
  it('keeps Upcoming copy when Coming Soon is off', () => {
    assert.equal(
      formatStatusChangeListingMessage('upcoming', 'Aalo'),
      'Aalo is now listed as Upcoming, and may be opening for allocation soon',
    );
    assert.equal(
      formatStatusChangeListingMessage('upcoming', 'Aalo', { comingSoon: false }),
      'Aalo is now listed as Upcoming, and may be opening for allocation soon',
    );
  });

  it('folds Coming Soon into Upcoming status-change listing message', () => {
    assert.equal(
      formatStatusChangeListingMessage('upcoming', 'Aalo', { comingSoon: true }),
      'Aalo is now marked as Coming Soon, and may be opening for allocation soon.',
    );
  });

  it('does not alter Active listing when comingSoon is passed', () => {
    assert.equal(
      formatStatusChangeListingMessage('active', 'Aalo', { comingSoon: true }),
      'Aalo is now listed as Active, and open for allocation immediately',
    );
  });
});

describe('shouldNotifyComingSoonFlip', () => {
  it('sends when Coming Soon flips on while already upcoming', () => {
    assert.equal(
      shouldNotifyComingSoonFlip({
        previousStatus: 'upcoming',
        newStatus: 'upcoming',
        previousComingSoon: false,
        newComingSoon: true,
      }),
      true,
    );
  });

  it('does not send a separate email when the same save transitions into upcoming', () => {
    assert.equal(
      shouldNotifyComingSoonFlip({
        previousStatus: 'potential',
        newStatus: 'upcoming',
        previousComingSoon: false,
        newComingSoon: true,
      }),
      false,
    );
    assert.equal(
      shouldNotifyComingSoonFlip({
        previousStatus: 'draft',
        newStatus: 'upcoming',
        previousComingSoon: false,
        newComingSoon: true,
      }),
      false,
    );
  });

  it('does not send when Coming Soon turns off', () => {
    assert.equal(
      shouldNotifyComingSoonFlip({
        previousStatus: 'upcoming',
        newStatus: 'upcoming',
        previousComingSoon: true,
        newComingSoon: false,
      }),
      false,
    );
  });

  it('does not send when Coming Soon stays on', () => {
    assert.equal(
      shouldNotifyComingSoonFlip({
        previousStatus: 'upcoming',
        newStatus: 'upcoming',
        previousComingSoon: true,
        newComingSoon: true,
      }),
      false,
    );
  });
});
