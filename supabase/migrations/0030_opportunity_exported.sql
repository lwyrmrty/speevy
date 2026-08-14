-- audit_action: record opportunity export downloads
alter type public.audit_action add value if not exists 'opportunity.exported';
