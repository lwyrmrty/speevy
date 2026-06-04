// lib/nda/account-default.ts
//
// Server-only helper to resolve THE standard account-level NDA template — the
// active (archived_at IS NULL) nda_templates row with is_account_default = true.
// A partial unique index guarantees at most one such row.
//
// Reads via the service-role client because LP-facing NDA flows (onboarding /
// outsider) need the source file but LPs have no read access to nda_templates.
// Callers must already have authorized the request. Returns null when no
// account-default template is configured — callers must treat that as a
// skip/clear-error, never a crash (the account NDA is informational and a
// missing default must not block onboarding). See docs/nda-gate-design.md §4B.3.

import { createSupabaseAdminClient } from '@/lib/supabase/admin';

if (typeof window !== 'undefined') {
  throw new Error('lib/nda/account-default must only be imported on the server.');
}

export type AccountDefaultNdaTemplate = {
  id: string;
  name: string;
  signatureProvider: string;
  sourceFileUrl: string;
  fieldsConfig: Record<string, unknown>;
};

export async function getAccountDefaultNdaTemplate(): Promise<AccountDefaultNdaTemplate | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('nda_templates')
    .select('id, name, signature_provider, source_file_url, fields_config')
    .eq('is_account_default', true)
    .is('archived_at', null)
    .maybeSingle();

  if (!data) return null;

  const fieldsConfig =
    data.fields_config && typeof data.fields_config === 'object'
      ? (data.fields_config as Record<string, unknown>)
      : {};

  return {
    id: data.id,
    name: data.name,
    signatureProvider: data.signature_provider,
    sourceFileUrl: data.source_file_url,
    fieldsConfig,
  };
}
