# Speevy

Speevy is Harpoon Ventures' internal LP portal for pre-marketing and managing SPV opportunities.

This app was bootstrapped from the `SpeevyStarter` package in the parent workspace. It keeps the starter's constraints intact:

- Invite-only LP access, no public signup.
- Supabase Auth, Postgres, Storage, and RLS.
- Drizzle schema as the source of truth for database types.
- Server Components by default, Server Actions for mutations.
- Opportunity pages composed from a fixed section registry, not a generic block editor.

## Getting Started

Install a package manager first. `pnpm` is recommended, matching the starter docs.

```bash
cd speevy
pnpm install
pnpm dev
```

Copy `.env.example` to `.env.local` and fill in the Supabase values before wiring live auth or database access.

## Database Setup

The starter files are already in their intended app locations:

- `db/schema.ts`
- `supabase/migrations/0001_rls_policies.sql`
- `.cursorrules`

After dependencies and environment variables are in place:

```bash
pnpm drizzle-kit push
psql "$DATABASE_URL" -f supabase/migrations/0001_rls_policies.sql
```

Admin promotion must remain SQL-only:

```sql
update public.profiles set role = 'admin' where email = 'you@harpoon.vc';
```

## Auth Pages

The passwordless auth surfaces are implemented with an Untitled UI inspired
split-view layout:

- `app/login/page.tsx` — returning admin/LP login
- `app/invite/[token]/page.tsx` — invite-link acceptance surface
- `components/auth/otp-login-form.tsx` — two-step email code form
- `components/auth/split-auth-shell.tsx` — shared split layout

The `/login` form uses Supabase email OTP via Server Actions. Regular login is
approved-only: admins can log in with `profiles.role = 'admin'`; LPs must have
an `lps.status = 'approved'` row. The approval check runs before sending a code
and again after verification.

To use Loops for auth emails, configure Loops SMTP in Supabase and set the
Supabase Magic Link/Confirm Signup templates to send a Loops JSON payload with
`{{ .Token }}`. Supabase still generates and verifies the code; Loops sends the
email.

Recommended Untitled UI source component:

```bash
npx untitledui@latest add login-split-image --yes
```

Speevy has no public signup page. Invite links route to `/invite/[token]` and
use a separate invite action path; token validation and first-time LP/profile
linking will be added when the invitation token model is implemented.

## Current State

The first screen is a polished static LP portal preview using typed mock data.
The login screen is scaffolded with approved-only Supabase OTP Server Actions.
The invite screen has the split-view acceptance UI and placeholder invite
actions. The next phase 1 work is invitation token validation, LP row linking,
and KYC/accreditation onboarding.

## shadcn/ui

shadcn/ui is configured and ready. After installing dependencies:

```bash
pnpm install
npx shadcn@latest add dialog sheet button
```

Components land in `components/ui/`. Use them for interactive areas like modals, sidepanels, forms, and tables — page shells still come from Webflow HTML.

Configured files:

- `components.json` — CLI config and aliases
- `lib/utils.ts` — `cn()` helper
- `components/ui/button.tsx` — starter component
- `app/globals.css` — shadcn theme tokens mapped to Speevy colors

## Untitled UI Form Inputs

Untitled UI input and toggle components are installed for shared app forms:

- `components/base/input/input.tsx` — base text/email/password input
- `components/base/input/input-group.tsx` — leading/trailing addons and prefixes
- `components/base/input/input-file.tsx` — file upload input
- `components/base/input/input-date.tsx` — date input
- `components/base/input/input-number.tsx` — horizontal/vertical number input
- `components/base/input/input-payment.tsx` — payment/card input
- `components/base/input/input-tags.tsx` and `input-tags-outer.tsx` — tag inputs
- `components/base/input/pin-input.tsx` — OTP/PIN input

Import from the barrel when possible:

```tsx
import { Input, InputGroup, InputFile } from '@/components/base/input';
```

These are the default field primitives for admin and investor forms unless a
Webflow-provided page calls for a different static element.

Toggles live at `components/base/toggle/toggle.tsx`:

```tsx
import { Toggle } from '@/components/base/toggle/toggle';

export const DefaultDemo = () => (
  <Toggle
    label="Remember me"
    hint="Save my login details for next time."
    size="sm"
  />
);
```
