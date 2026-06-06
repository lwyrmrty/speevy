-- Add "Coming Soon" opportunity status (same visibility/interest rules as potential).
alter type public.opportunity_status add value if not exists 'coming_soon';
