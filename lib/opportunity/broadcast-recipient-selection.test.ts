import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  findMatchingSectors,
  normalizeSectors,
  shouldIncludeLpForNewOpportunityBroadcast,
  shouldIncludeLpForStatusChangeBroadcast,
} from '@/lib/opportunity/broadcast-recipient-selection';
import {
  parseLpNotificationPreference,
  shouldNotifyLpForBroadcastEvent,
} from '@/lib/lp/notification-preferences';
import { isLpBroadcastStatusChange } from '@/lib/opportunity/opportunity-status-labels';

describe('parseLpNotificationPreference', () => {
  it('returns valid preferences unchanged', () => {
    assert.equal(parseLpNotificationPreference('always'), 'always');
    assert.equal(parseLpNotificationPreference('sector_match'), 'sector_match');
    assert.equal(parseLpNotificationPreference('never'), 'never');
  });

  it('defaults unknown values to always', () => {
    assert.equal(parseLpNotificationPreference(null), 'always');
    assert.equal(parseLpNotificationPreference(undefined), 'always');
    assert.equal(parseLpNotificationPreference('invalid'), 'always');
  });
});

describe('shouldNotifyLpForBroadcastEvent', () => {
  it('never suppresses all broadcasts', () => {
    assert.equal(shouldNotifyLpForBroadcastEvent('never', ['AI']), false);
    assert.equal(shouldNotifyLpForBroadcastEvent('never', []), false);
  });

  it('always notifies regardless of sector overlap', () => {
    assert.equal(shouldNotifyLpForBroadcastEvent('always', []), true);
    assert.equal(shouldNotifyLpForBroadcastEvent('always', ['Energy']), true);
  });

  it('sector_match requires overlap', () => {
    assert.equal(shouldNotifyLpForBroadcastEvent('sector_match', []), false);
    assert.equal(shouldNotifyLpForBroadcastEvent('sector_match', ['AI']), true);
  });
});

describe('isLpBroadcastStatusChange', () => {
  it('treats active and upcoming as preference-gated broadcasts', () => {
    assert.equal(isLpBroadcastStatusChange('active'), true);
    assert.equal(isLpBroadcastStatusChange('upcoming'), true);
    assert.equal(isLpBroadcastStatusChange('closed'), false);
    assert.equal(isLpBroadcastStatusChange('potential'), false);
  });
});

describe('shouldIncludeLpForNewOpportunityBroadcast', () => {
  const opportunitySectors = ['Energy'];

  it('includes always even without sector overlap', () => {
    assert.equal(
      shouldIncludeLpForNewOpportunityBroadcast(
        {
          new_opportunity_notification_preference: 'always',
          sectors_interested: ['AI'],
        },
        opportunitySectors,
      ),
      true,
    );
  });

  it('excludes never even with sector overlap', () => {
    assert.equal(
      shouldIncludeLpForNewOpportunityBroadcast(
        {
          new_opportunity_notification_preference: 'never',
          sectors_interested: ['Energy'],
        },
        opportunitySectors,
      ),
      false,
    );
  });

  it('sector_match requires overlap', () => {
    assert.equal(
      shouldIncludeLpForNewOpportunityBroadcast(
        {
          new_opportunity_notification_preference: 'sector_match',
          sectors_interested: ['AI'],
        },
        opportunitySectors,
      ),
      false,
    );
    assert.equal(
      shouldIncludeLpForNewOpportunityBroadcast(
        {
          new_opportunity_notification_preference: 'sector_match',
          sectors_interested: ['Energy', 'AI'],
        },
        opportunitySectors,
      ),
      true,
    );
  });
});

describe('shouldIncludeLpForStatusChangeBroadcast', () => {
  const opportunitySectors = ['Energy'];

  it('active and upcoming honor active_opportunity_notification_preference', () => {
    for (const newStatus of ['active', 'upcoming'] as const) {
      assert.equal(
        shouldIncludeLpForStatusChangeBroadcast(
          {
            active_opportunity_notification_preference: 'never',
            sectors_interested: ['Energy'],
          },
          opportunitySectors,
          newStatus,
        ),
        false,
      );
      assert.equal(
        shouldIncludeLpForStatusChangeBroadcast(
          {
            active_opportunity_notification_preference: 'always',
            sectors_interested: ['AI'],
          },
          opportunitySectors,
          newStatus,
        ),
        true,
      );
      assert.equal(
        shouldIncludeLpForStatusChangeBroadcast(
          {
            active_opportunity_notification_preference: 'sector_match',
            sectors_interested: ['AI'],
          },
          opportunitySectors,
          newStatus,
        ),
        false,
      );
    }
  });

  it('does not notify for other status changes', () => {
    assert.equal(
      shouldIncludeLpForStatusChangeBroadcast(
        {
          active_opportunity_notification_preference: 'always',
          sectors_interested: ['Energy'],
        },
        opportunitySectors,
        'closed',
      ),
      false,
    );
    assert.equal(
      shouldIncludeLpForStatusChangeBroadcast(
        {
          active_opportunity_notification_preference: 'always',
          sectors_interested: ['Energy'],
        },
        opportunitySectors,
        'potential',
      ),
      false,
    );
  });

  it('active broadcast includes LPs when opportunity has no sectors and preference is always', () => {
    assert.equal(
      shouldIncludeLpForStatusChangeBroadcast(
        {
          active_opportunity_notification_preference: 'always',
          sectors_interested: ['AI'],
        },
        [],
        'active',
      ),
      true,
    );
  });
});

describe('sector helpers', () => {
  it('normalizes and matches sectors', () => {
    assert.deepEqual(normalizeSectors([' AI ', 'Energy', 'Not A Sector']), ['AI', 'Energy']);
    assert.deepEqual(
      findMatchingSectors(['AI', 'Defense'], ['Energy', 'AI']),
      ['AI'],
    );
  });
});
