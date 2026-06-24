import { INVESTOR_SECTORS } from '@/lib/investor-request';
import {
  parseLpNotificationPreference,
  shouldNotifyLpForBroadcastEvent,
} from '@/lib/lp/notification-preferences';
import { isLpBroadcastStatusChange } from '@/lib/opportunity/opportunity-status-labels';

export function normalizeSectors(value: unknown) {
  const sectors = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? [value]
      : [];

  return Array.from(new Set(
    sectors
      .map((sector) => (typeof sector === 'string' ? sector.trim() : sector))
      .filter((sector): sector is string =>
        typeof sector === 'string'
        && sector.length > 0
        && (INVESTOR_SECTORS as readonly string[]).includes(sector),
      ),
  ));
}

export function findMatchingSectors(lpSectors: string[], opportunitySectors: string[]) {
  const opportunitySectorSet = new Set(opportunitySectors);
  return lpSectors.filter((sector) => opportunitySectorSet.has(sector));
}

export function shouldIncludeLpForNewOpportunityBroadcast(
  lp: {
    new_opportunity_notification_preference: unknown;
    sectors_interested: unknown;
  },
  opportunitySectors: unknown,
) {
  const normalizedOpportunitySectors = normalizeSectors(opportunitySectors);
  const preference = parseLpNotificationPreference(lp.new_opportunity_notification_preference);
  const matchingSectors = findMatchingSectors(
    normalizeSectors(lp.sectors_interested),
    normalizedOpportunitySectors,
  );

  return shouldNotifyLpForBroadcastEvent(preference, matchingSectors);
}

export function shouldIncludeLpForStatusChangeBroadcast(
  lp: {
    active_opportunity_notification_preference: unknown;
    sectors_interested: unknown;
  },
  opportunitySectors: unknown,
  newStatus: string,
) {
  if (!isLpBroadcastStatusChange(newStatus)) {
    return false;
  }

  const normalizedOpportunitySectors = normalizeSectors(opportunitySectors);
  const matchingSectors = normalizedOpportunitySectors.length > 0
    ? findMatchingSectors(
        normalizeSectors(lp.sectors_interested),
        normalizedOpportunitySectors,
      )
    : [];

  const preference = parseLpNotificationPreference(lp.active_opportunity_notification_preference);
  return shouldNotifyLpForBroadcastEvent(preference, matchingSectors);
}
