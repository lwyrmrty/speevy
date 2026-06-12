/**
 * Updates Supabase Auth URL configuration for spv.harpoon.vc.
 *
 * Requires SUPABASE_ACCESS_TOKEN (Dashboard → Account → Access Tokens,
 * scope: auth_config_write or project admin).
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/update-supabase-auth-urls.mjs
 */

const PROJECT_REF = 'nzjbssgsjuatzpxaqtxi';
const SITE_URL = 'https://spv.harpoon.vc';
const REQUIRED_REDIRECTS = [
  'https://spv.harpoon.vc/**',
  'https://speevy.vc/**',
  'http://localhost:3000/**',
];

const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
if (!token) {
  console.error(
    'Missing SUPABASE_ACCESS_TOKEN. Create one at https://supabase.com/dashboard/account/tokens',
  );
  process.exit(1);
}

const apiBase = 'https://api.supabase.com/v1';
const headers = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
};

function parseAllowList(value) {
  if (!value || typeof value !== 'string') return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function mergeAllowList(existing) {
  const merged = new Set([...existing, ...REQUIRED_REDIRECTS]);
  return [...merged].join(',');
}

const getRes = await fetch(`${apiBase}/projects/${PROJECT_REF}/config/auth`, {
  headers,
});

if (!getRes.ok) {
  console.error(`Failed to read auth config (${getRes.status}):`, await getRes.text());
  process.exit(1);
}

const current = await getRes.json();
const existingAllowList = parseAllowList(current.uri_allow_list);
const uri_allow_list = mergeAllowList(existingAllowList);

const patchBody = {
  site_url: SITE_URL,
  uri_allow_list,
};

const patchRes = await fetch(`${apiBase}/projects/${PROJECT_REF}/config/auth`, {
  method: 'PATCH',
  headers,
  body: JSON.stringify(patchBody),
});

if (!patchRes.ok) {
  console.error(`Failed to update auth config (${patchRes.status}):`, await patchRes.text());
  process.exit(1);
}

const updated = await patchRes.json();
console.log('Supabase Auth URL configuration updated.');
console.log(`  site_url: ${updated.site_url ?? SITE_URL}`);
console.log(`  uri_allow_list entries: ${parseAllowList(updated.uri_allow_list ?? uri_allow_list).length}`);
