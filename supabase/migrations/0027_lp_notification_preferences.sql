-- LP account-level email notification preferences for platform-wide opportunity events.

create type public.lp_notification_preference as enum ('always', 'sector_match', 'never');

alter table public.lps
  add column new_opportunity_notification_preference public.lp_notification_preference not null default 'always',
  add column active_opportunity_notification_preference public.lp_notification_preference not null default 'always';

alter type public.audit_action add value if not exists 'lp.notification_preferences_updated';
