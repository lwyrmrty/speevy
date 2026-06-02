alter table public.opportunities
  add column if not exists website_url text,
  add column if not exists linkedin_url text,
  add column if not exists twitter_url text;
