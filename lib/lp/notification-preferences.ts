export const LP_NOTIFICATION_PREFERENCE_VALUES = ['always', 'sector_match', 'never'] as const;

export type LpNotificationPreference = (typeof LP_NOTIFICATION_PREFERENCE_VALUES)[number];

export function parseLpNotificationPreference(value: unknown): LpNotificationPreference {
  if (
    value === 'always'
    || value === 'sector_match'
    || value === 'never'
  ) {
    return value;
  }

  return 'always';
}

export function shouldNotifyLpForBroadcastEvent(
  preference: LpNotificationPreference,
  matchingSectors: string[],
): boolean {
  if (preference === 'never') {
    return false;
  }

  if (preference === 'always') {
    return true;
  }

  return matchingSectors.length > 0;
}
