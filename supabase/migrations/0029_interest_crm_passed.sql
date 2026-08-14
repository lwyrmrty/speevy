-- Add Passed to the deal CRM pipeline and an audit action for list emails.

alter type public.interest_pipeline_status add value if not exists 'passed';
alter type public.audit_action add value if not exists 'interest.crm_email_sent';
