# NDA Gate — Design / Planning Doc

> Status: **Decisions recorded; partially confirmed.** No application code is
> changed by this doc.
> Scope: gating an opportunity's **section body** behind a completed NDA.
>
> **Decisions taken by the user (v1):**
> 1. **Signing engine = SignatureAPI (committed).** `signature_provider` stays
>    pluggable in the schema, but v1 ships `'signatureapi'` only. (The column
>    currently defaults to `'dropbox_sign'` — §5 proposes a migration to change
>    the default/enum to `'signatureapi'`.) **Dropbox Sign is demoted to
>    "Alternatives Considered"** alongside DocuSign / Documenso / PandaDoc /
>    DocSend; it is retained and documented (including why it was passed over:
>    Enterprise account + sales gate for API/embedded signing, low monthly
>    signature-request caps otherwise, and high cost). The DocSend paths (and the
>    honest "no usable direct DocSend API" finding) are likewise retained as
>    Alternatives, not a v1 build target.
> 2. **Countersignature = undecided** — left as an open question. The data model
>    and flow are designed so adding a Harpoon countersigner later is
>    **non-breaking**: the unlock keys off the **all-signers / `envelope.completed`**
>    event (SignatureAPI's `recipients` array, parallel or sequential), not a
>    single signer's completion.
> 3. **Access model redesign = PROPOSED, pending the user's internal
>    confirmation.** Replace the password-protected-page mechanism with an
>    **insider/outsider** investor classification + **per-opportunity audience**,
>    and make a signed NDA a **universal** precondition for viewing any
>    opportunity body. See the new **§4A. Access Model Redesign**. Everything in
>    §4A is marked proposed until the user confirms.

---

## 1. Executive Summary & Core Recommendation

### What the user wants (mental model)

> "Create the NDA in our DocSend account, then in Speevy on an opportunity page
> select that DocSend document as the NDA they must complete to view the
> opportunity. Wire it so that to see the opportunity, they must have already
> completed the NDA."

This is the right product shape. The friction is **not** product — it's that
DocSend gives us almost nothing to build a *reliable, transactional* completion
signal on.

### The honest constraint (verified June 2026, high confidence)

- There is **no public/self-serve DocSend developer REST API, no SDK, no
  developer docs**, and DocSend is absent from the Dropbox developer platform.
- There is **no native (non-Zapier) developer-registered DocSend webhook** for
  "agreement/NDA signed".
- The `api.docsend.com/v1` "docs" on rollout.com / apirefs.com are **fabricated
  SEO spam** — those endpoints 404; `api.docsend.com` just 302s to the web app
  (it is the SPA's private backend, not a public API).
- An "Enterprise-only API" is claimed only by secondary blogs, contradicted by
  others, undocumented by Dropbox — **UNVERIFIED**; must be confirmed with
  DocSend sales before we design against it.
- **iframe + postMessage is not viable**: DocSend sends
  `X-Frame-Options: SAMEORIGIN` and emits no signed-event `postMessage`.
- Reverse-engineering the private SPA API is **rejected** for a compliance
  product (fragile + ToS risk).

The only real DocSend completion signals are:

1. **DocSend → Zapier "New signed document" trigger** → Zapier Webhook action →
   a Speevy webhook endpoint. Reliable/managed, but inserts Zapier as a third
   party. From our code's POV it is still "a signed POST to our endpoint."
2. **Inbound-email signal**: on completion DocSend emails the link **owner**
   (and signer) a signed copy + signature certificate. A dedicated owner inbox +
   inbound-email parser (Postmark/SendGrid Inbound Parse) → webhook → flip the
   gate. **Brittle** (email delays/spam/template changes/parsing); best-effort,
   not transactional; needs a manual backstop. (Note: Dropbox's "auto-save
   signed DocSend docs to Dropbox" feature **excludes NDAs**, so that cleaner
   path is unavailable.)

### Core recommendation (decided)

**v1 ships a single signing engine: SignatureAPI.** The gate is keyed on the
existing `opportunity_ndas.signature_provider` column, which stays pluggable, but
v1 only implements `'signatureapi'`.

- **Engine — SignatureAPI (committed).** Real eSignature API with **embeddable
  signing ceremonies** inside Speevy (`embeddable_in` origin whitelist +
  `&embedded=true&event_delivery=message`), **Standard Webhooks** HMAC-verified
  events (`recipient.completed` / `envelope.completed` = the clean "unlock the
  body" trigger; `deliverable.generated` = sealed PDF ready), arbitrary
  **`envelope_metadata`** echoed back on every event (so `(lp_id,
  opportunity_id)` mapping needs no separate lookup), and a sealed signed-PDF +
  audit-log **Deliverable** retrievable via a 1-hour pre-signed URL. The phased
  plan (§11) builds toward this and nothing else for v1.

**Why SignatureAPI over Dropbox Sign (recorded rationale):**

- **Dropbox Sign requires an Enterprise account + a sales process** to unlock
  API / embedded-signing access, and is otherwise limited to very few signature
  requests per month — and is expensive. That gate is a poor fit for a small
  team shipping now.
- **SignatureAPI is self-serve**: ~**$25/mo with the first 100 envelopes
  included, then ~$0.25/envelope, billed only on *completed* envelopes**, plus a
  **free test tier** and **no sales process**.
- **Compliance signals:** SignatureAPI is **SOC 2 Type II** and claims
  **ESIGN / UETA / eIDAS-SES** conformance.
- **Vendor-youth risk (be honest):** founded **2023**, **GA Oct 2024**. It is a
  young vendor. **Before go-live we must obtain an SLA, the SOC 2 Type II
  report, and a signed DPA** (see the due-diligence checklist in §11), and keep
  `signature_provider` pluggable so we can swap engines if the vendor falters.

**Alternatives Considered (not v1):** Dropbox Sign (Enterprise gate + low volume
caps + cost), DocuSign (heavier/pricier), PandaDoc, Documenso (self-host/operate
yourself), and DocSend (no usable direct API/webhook — see the constraint above;
only viable via Zapier/inbound-email bridges). Any of these can slot in later via
a new `signature_provider` value without touching the gate's RLS or core schema.

> **Coupled decision (proposed):** the access model is also being reworked — see
> **§4A** — so that *every* viewer is an authenticated LP and an NDA is required
> universally. That redesign is what lets the universal-NDA rule be enforced
> cleanly in one place (RLS).

---

## 2. Decision Matrix (engine decision: **SignatureAPI**)

> **Decided:** v1 = SignatureAPI. The matrix below is retained as the rationale
> for that decision and as the reference for the alternatives (Dropbox Sign,
> DocSend, Documenso) we are **not** building in v1.

Dimensions scored for our specific context (internal LP portal, Reg D 506(b),
low-to-moderate signing volume, compliance-sensitive, small eng team shipping
now).

| Dimension | **SignatureAPI** | Dropbox Sign | DocSend + Zapier/email | Documenso (self-host) |
|---|---|---|---|---|
| Onboarding / access | **Self-serve, no sales process; free test tier** | **Enterprise account + sales process** for API/embedded | DocSend plan + Zapier/inbound-email plumbing | Self-host, no vendor signup |
| Real-time signal reliability | **High** — Standard Webhooks HMAC, retries | High — HMAC webhook | Medium/Low — relay hop or email parsing | High — but you operate it |
| Audit / compliance fit (Reg D 506(b)) | **High** — sealed PDF + audit log Deliverable; SOC 2 Type II; ESIGN/UETA/eIDAS-SES | High — audit-trail PDF | Medium/Low — cert indirect | High — you own the infra |
| Mapping to (lp, opportunity) | **Cleanest** — arbitrary `envelope_metadata` echoed on every event | Stored `signature_request_id` → record lookup | Email/document heuristics + manual queue | Your own metadata |
| Countersignature (Harpoon signs too) | **Native** — `recipients` array, parallel/sequential; `envelope.completed` | Native | Weak/manual | Supported |
| Embedded vs redirect UX | **Embedded** ceremony iframe (`embeddable_in` + `event_delivery=message`) | Embedded (JS SDK + app client id) | Redirect (DocSend `SAMEORIGIN`) | Embedded possible |
| Reusable NDA source | DOCX/PDF in **Library by URL** or upload API; `{{merge}}` / `[[place]]` markers; **Speevy-owned catalog** | First-class hosted **template id** + list API | DocSend link/space | Your templates |
| Cost / plan tier | **~$25/mo, first 100 envelopes incl., then ~$0.25/completed envelope** | Enterprise pricing; low monthly caps otherwise | DocSend + Zapier/email vendor | Infra + ops time |
| Vendor maturity / longevity | **Young** (founded 2023, GA Oct 2024) — get SLA/SOC2/DPA | Established | Established | You own it |
| Build effort | **Low–Medium** (REST + Standard Webhooks + catalog table) | Low–Medium (SDK + webhook) but blocked on sales | Medium/High (mapping + backstop) | High (self-host + ops) |

### Outcome & where the alternatives could still win

- **Chosen for v1: SignatureAPI.** Self-serve, embeddable, clean webhook +
  metadata mapping, strong compliance signals, low cost. Its one real risk is
  vendor youth, mitigated by keeping `signature_provider` pluggable and doing
  pre-go-live due diligence (§11).
- **Dropbox Sign (alternative, not v1):** the natural fallback engine if
  SignatureAPI falters — mature and well-trodden, but blocked behind an
  Enterprise account + sales process and higher cost, with low monthly caps
  otherwise. Slots in via `signature_provider = 'dropbox_sign'`.
- **DocSend (alternative, not v1):** only if the deck's DocSend hosting + viewer
  analytics become a hard requirement, and only via Zapier/inbound-email bridges
  (no usable direct API). Prefer a hybrid: DocSend hosts the deck, the committed
  engine signs.
- **DocuSign / PandaDoc (alternatives, not v1):** heavier and pricier; revisit
  only if an enterprise procurement or specific feature forces it.
- **Documenso (alternative, not v1):** only if we later need to drop all
  external eSignature vendors and operate signing infra ourselves.

---

## 3. End-to-End Flows

### 3a. SignatureAPI (embedded ceremony) — the v1 flow

```mermaid
sequenceDiagram
    actor Admin
    participant Editor as Opportunity Editor
    participant Cat as nda_templates (Speevy catalog)
    participant DB as Postgres (RLS)
    actor LP
    participant Detail as Opportunity Detail Page
    participant Gate as OpportunityNdaGate
    participant SA as Server Actions
    participant SAPI as SignatureAPI
    participant WH as /api/webhooks/signatureapi

    Note over Admin,Cat: One-time: admin prepares DOCX/PDF with {{merge}} + [[place]] markers,<br/>uploads to SignatureAPI Library (stable URL), registers it as an nda_templates row
    Admin->>Editor: Pick NDA from dropdown (reads nda_templates)
    Editor->>SA: saveOpportunity (nda_template_id -> nda_templates row)
    SA->>DB: update opportunities (admin-role checked first)

    LP->>Detail: Visit gated opportunity
    Detail->>DB: RLS read sections (blocked: no signed NDA)
    Detail->>Gate: Render teaser + "Review & sign NDA" CTA
    LP->>SA: getNdaCeremonyUrl()  (calls createOpportunityNdaEnvelope if none)
    SA->>SA: validate caller + access + NDA required
    SA->>SAPI: create envelope (source file from catalog, recipient=LP,<br/>delivery_type:none, embeddable_in: Speevy origin,<br/>envelope_metadata:{opportunity_id, lp_id})
    SAPI-->>SA: envelope id + recipient ceremony URL
    SA->>DB: upsert opportunity_ndas (status='sent', envelope_id) [service role]
    SA->>DB: audit_log 'nda.sent' (same txn)
    SA-->>Gate: ceremony URL
    Gate->>SAPI: open ceremony iframe (&embedded=true&event_delivery=message)
    LP->>SAPI: Completes ceremony (UI 'message' event = cue only)
    SAPI->>WH: recipient.completed / envelope.completed (Standard Webhooks HMAC)
    WH->>WH: verify webhook-signature + idempotency (event id)
    WH->>DB: upsert opportunity_ndas status='signed' (metadata maps lp+opportunity) [service role]
    WH->>DB: audit_log 'nda.signed' (same txn)
    SAPI->>WH: deliverable.generated
    WH->>SAPI: GET deliverable -> 1-hour pre-signed URL
    WH->>DB: download sealed PDF, store to Supabase Storage (signed_document_storage_key)
    LP->>Detail: refresh / poll
    Detail->>DB: RLS read sections (now ALLOWED)
    Detail-->>LP: Body unlocked (watermarked)
```

**Countersignature-ready (decision deferred).** The unlock fires on the
**all-signers** signal — `envelope.completed` — **not** a single recipient's
`recipient.completed`. If Harpoon later decides the NDA needs a Harpoon
countersigner, add a second entry to SignatureAPI's `recipients` array
(signer / approver — parallel or sequential); the gate logic is unchanged
because the body unlocks only once the **envelope** is complete. No schema or RLS
change is needed; `opportunity_ndas.status='signed'` means "fully executed."
(For a single-signer NDA, `recipient.completed` and `envelope.completed`
coincide; keying on `envelope.completed` is the forward-compatible choice — see
§6.1.)

### 3b. Provider Flow Comparison (SignatureAPI vs Dropbox Sign)

Side-by-side of the v1 engine (SignatureAPI) against the closest alternative
(Dropbox Sign), to make the architectural differences explicit:

| Stage | **SignatureAPI (v1)** | Dropbox Sign (alternative) |
|---|---|---|
| **NDA setup / reuse** | No hosted "Template" resource. Reuse via a **DOCX/PDF source file** stored in the dashboard **Library** (stable URL) or via the "store an upload" API, with **`{{merge}}`** placeholders for dynamic content and **`[[place]]`** placeholders for signature/field positions. | First-class **hosted Template** with editor + a stable **template id**. |
| **Admin "pick an NDA" dropdown** | Backed by a **Speevy-owned `nda_templates` catalog table** (SignatureAPI has no listable template API), populated after the admin registers a Library file. | Backed by Dropbox Sign's live **"list templates"** API. |
| **Send / sign** | `createOpportunityNdaEnvelope`: create envelope from the catalog source file, `delivery_type: none`, `embeddable_in` whitelists the Speevy origin, attach `envelope_metadata` `{opportunity_id, lp_id}` → returns a **recipient ceremony URL** embedded in an iframe with **`&embedded=true&event_delivery=message`**. | Create signature request from **`template_id`** + embedded signing URL via the **JS SDK / app client id**. |
| **Completion webhook** | **Standard Webhooks** HMAC (`webhook-signature` header, `standardwebhooks` lib). `recipient.completed` / `envelope.completed`. **`envelope_metadata` is echoed on every event** → `(lp_id, opportunity_id)` maps directly, **no separate lookup strictly required** (still persist the envelope id). | HMAC (`event_hash`) `signature_request_all_signed`; map via a stored **`signature_request_id` → (lp, opportunity)** record. |
| **Executed document** | **Deliverable** = sealed signed PDF **+ audit log**; `deliverable.generated` → `GET deliverable` returns a **1-hour pre-signed URL** → store to Supabase Storage. | Fetch executed PDF via API after `all_signed`. |
| **Countersignature** | `recipients` array (signer / approver / preparer / automatic signer), **parallel or sequential**; **`envelope.completed`** = all done. | Add signer to template; **`signature_request_all_signed`** = all done. |
| **Idempotency / mapping store** | Event id (Standard Webhooks) + persisted `envelope_id`. | Provider event id + persisted `signature_request_id`. |

Both engines converge on the same Speevy invariant: **`opportunity_ndas.status =
'signed'` is written only on the all-signers event**, and that single row is what
RLS checks. The provider is an implementation detail behind
`signature_provider`.

### 3c. DocSend-hosted NDA + completion bridge — *Alternative / Future (not v1)*

```mermaid
sequenceDiagram
    actor Admin
    participant DocSend as DocSend (web app)
    participant Editor as Opportunity Editor
    participant DB as Postgres (RLS)
    actor LP
    participant Detail as Opportunity Detail Page
    participant Gate as OpportunityNdaGate
    participant SA as Server Actions
    participant Bridge as Zapier OR Inbound-Email
    participant WH as /api/webhooks/docsend

    Admin->>DocSend: Create NDA-gated space/link (per-opportunity)
    Admin->>Editor: Toggle "Require NDA" + provider=docsend + paste DocSend link/space id
    Editor->>SA: saveOpportunity (nda_required, provider, nda_template_id=link/space ref)
    SA->>DB: update opportunities (admin-role checked first)

    LP->>Detail: Visit gated opportunity
    Detail->>DB: RLS read sections (blocked)
    Detail->>Gate: Render teaser + "Review & sign NDA" CTA (redirect)
    LP->>SA: startDocSendNda()
    SA->>DB: upsert opportunity_ndas (status='sent', envelope_id=mapping token) [service role]
    SA->>DB: audit_log 'nda.sent'
    SA-->>Gate: DocSend link (opens new tab) + mapping token
    LP->>DocSend: Enter name+email, sign NDA
    DocSend->>Bridge: "New signed document" (Zapier trigger) OR owner-inbox email
    Bridge->>WH: POST {signer_email, document/link id, signed_at, [token]} (shared secret / inbound auth)
    WH->>WH: verify secret + idempotency
    WH->>WH: map (signer_email + document id) -> (lp_id, opportunity_id)
    alt mapping resolved
        WH->>DB: upsert opportunity_ndas status='signed' [service role]
        WH->>DB: audit_log 'nda.signed'
    else mapping ambiguous / email mismatch
        WH->>DB: park event in reconciliation queue (admin resolves)
    end
    LP->>Detail: refresh / poll
    Detail->>DB: RLS read sections (ALLOWED once status='signed')
```

---

## 4. Enforcement Design (Belt & Suspenders)

The gate already exists in RLS. The work is (a) wiring the *write* of the
`signed` row, and (b) **closing the service-role bypass on the detail page** so
the gate is actually enforced for non-LP viewers.

### 4.1 What RLS already enforces (good)

`opportunity_sections` SELECT for an LP requires a signed NDA when
`nda_required = true`:

```207:215:supabase/migrations/0001_rls_policies.sql
        and (
          o.nda_required = false
          or exists (
            select 1 from public.opportunity_ndas n
            where n.opportunity_id = o.id
              and n.lp_id = public.current_lp_id()
              and n.status = 'signed'
          )
        )
```

This is correct **only for a real session LP** reading via their RLS-bound
client. It is the database's independent check.

### 4.2 The service-role bypass gotcha (must fix)

The detail page picks the content client by viewer kind. Only `lp` uses the
RLS-bound session client; `admin` and `guest` use the service-role client, which
**bypasses the NDA gate entirely**:

```622:625:app/opportunities/[opportunityId]/page.tsx
  // Belt and suspenders: admins and outsiders read via the service-role client
  // (guarded by the checks above); invited LPs read via their RLS-bound session
  // so the database independently enforces their access.
  const contentClient = viewerKind === 'lp' ? serverSupabase : supabase;
```

```708:712:app/opportunities/[opportunityId]/page.tsx
  const { data: sections } = await contentClient
    .from('opportunity_sections')
    .select('type, position, data')
    .eq('opportunity_id', opportunity.id)
    .order('position', { ascending: true });
```

**Resolution by viewer kind:**

- **Real session LP (`viewerKind === 'lp'`):** unchanged. RLS enforces the NDA
  gate at the DB. This is the authoritative path.
- **Admin (`viewerKind === 'admin'`):** allowed to read the body **as an explicit
  preview**, but the page MUST:
  1. Render a visible "Admin preview — NDA gate not applied" banner whenever
     `nda_required = true` and no signed `opportunity_ndas` row exists for an
     impersonated/real LP, so admins are never fooled into thinking the gate is
     live.
  2. Continue to NOT write an `opportunity.viewed` LP audit row for admins
     (current behavior already only logs `lp`/`guest`).
- **Password guest (`viewerKind === 'guest'`):** **this is the real hole** in
  *today's* model. A guest currently reads sections via service role, bypassing
  the NDA gate, because guests have no `auth.uid()`/`current_lp_id()` for RLS to
  key on.
  - **Recommended resolution (proposed): delete the guest path entirely** via
    the access-model redesign in **§4A**. If password-protected sharing is
    removed and every viewer is an authenticated LP, this whole branch — and the
    service-role section read for non-admins — disappears, and the NDA gate is
    enforced in exactly one place (RLS). This is the clean fix.
  - **Interim (only if the redesign is not adopted):** add an explicit
    application-layer NDA check for guests before the service-role section read,
    using the guest's outsider `lp_id` against `opportunity_ndas` (see §4.4).

### 4.3 Server-Action enforcement (second belt)

Every NDA-related Server Action validates, in order:
1. **Caller identity/role** (admin actions check `is_admin()`-equivalent first
   line; LP actions resolve `current_lp_id()`).
2. **Access** to the opportunity (`visible_to_all_approved_lps` OR a non-revoked
   `opportunity_access` row), mirroring the existing interest action checks in
   `app/opportunities/actions.ts`.
3. **Opportunity state** (`nda_required = true`, published, not archived).

The `createOpportunityNdaEnvelope` / `getNdaCeremonyUrl` actions never return a
ceremony URL for a caller who lacks access — preventing NDA-link harvesting.

### 4.4 Password-guest × NDA policy (superseded by §4A if the redesign lands)

The recommended direction (**§4A**) **removes password-protected sharing
altogether**, which dissolves this tension: there are no anonymous guests, so
there is no guest×NDA edge case and no service-role section read to guard. This
subsection is retained only as the fallback if the §4A redesign is **not**
adopted.

Fallback options if password sharing is kept (recommended = Option 1):

- **Option 1: An NDA opportunity is never password-shared.** Make the NDA
  requirement and `password_protected` mutually exclusive in the editor +
  `saveOpportunity` validation. NDA deals require an attributable, authenticated
  LP — the Reg D 506(b) posture. Removes the guest×NDA bypass by construction.
- **Option 2: Guests can also be NDA-gated.** A guest must complete the NDA;
  their outsider `lp_id` keys `opportunity_ndas`, and the detail page adds an
  explicit guest NDA check before the service-role section read. More surface
  area, weaker identity assurance.

Whichever fallback is chosen, the guest service-role section read MUST be
guarded by an explicit NDA check (or made impossible via Option 1, or eliminated
via §4A).

---

## 4A. Access Model Redesign — Insider/Outsider + Universal NDA *(Proposed, pending user confirmation)*

> **Status: PROPOSED.** The user is strongly considering this but is still
> confirming it internally. Everything in §4A is a recommendation, not a decided
> spec. It is, however, the recommended direction because it makes the
> universal-NDA rule enforceable in **one** place and eliminates the
> service-role bypass (§4.2).

### 4A.1 The proposed model in one paragraph

Retire password-protected pages. Every investor is an **authenticated** LP
classified as **insider** or **outsider**. Every opportunity declares an
**audience** (insiders / outsiders / both). An LP can see an opportunity's
**row** (title, teaser) if they're approved and the audience matches; they can
see the **body** only after completing the NDA — and the NDA is **universal**
(required for every opportunity body, no per-deal opt-out). Because there are no
anonymous guests anymore, *all* reads go through RLS as a session user, so the
universal-NDA rule lives in exactly one enforceable place.

### 4A.2 Lifecycle vs audience are separate concerns (keep them separate)

`lps.status` is a **lifecycle** field — where the LP is in onboarding:

```43:53:db/schema.ts
export const lpStatus = pgEnum('lp_status', [
  'invited',
  'onboarding',
  'pending_review',
  'approved',
  'rejected',
  'removed',
  // People who unlocked a password-protected opportunity via a shared direct
  // link (email + password). Not invited LPs; no auth user. See 0008 migration.
  'outsider',
]);
```

"Insider vs outsider" is **not** a lifecycle stage — it's a durable
**classification/audience** of the investor that is orthogonal to how far along
onboarding they are. Conflating them (as the current `'outsider'` *status* value
does) is exactly what we want to undo. **Recommendation: add a separate
classification column** rather than overloading `status`:

```
-- new enum + column on lps
create type lp_audience as enum ('insider', 'outsider');
alter table public.lps
  add column audience lp_audience not null default 'outsider';
```

- `lps.status` keeps tracking lifecycle (`invited → onboarding → … → approved`).
- `lps.audience` tracks classification (`insider` | `outsider`).
- The legacy `lps.status = 'outsider'` **value is retired** (see migration
  §4A.6): those rows become real (or invited) LPs whose `audience = 'outsider'`.

A helper mirrors the existing RLS helpers:

```sql
create or replace function public.current_lp_audience()
returns lp_audience
language sql stable security definer set search_path = public
as $$ select audience from public.lps where profile_id = auth.uid() $$;
```

### 4A.3 Opportunity audience: recommend a single selector that **allows "both"**

Add an audience selector to the opportunity, replacing
`visible_to_all_approved_lps`:

```
create type opportunity_audience as enum ('insiders', 'outsiders', 'both');
alter table public.opportunities
  add column audience opportunity_audience not null default 'insiders';
```

**Recommendation: one selector with three values (`insiders | outsiders |
both`),** not two independent checkboxes. Three values cover every real case
(insider-only, outsider-only, everyone) while making the common mistake —
accidentally showing an insider deal to outsiders — impossible to express
ambiguously. `both` exists because some teasers/listings are legitimately for
everyone (it replaces today's `visible_to_all_approved_lps = true`).

**Per-LP `opportunity_access`: keep it, but make it optional and additive.**
Audience-based visibility becomes the *primary* gate. `opportunity_access`
remains useful as an **explicit narrowing allowlist** for deals that must be
shown to *specific* LPs rather than a whole audience (e.g., "this insider deal is
only for these three LPs"). Concrete rule:

- If an opportunity has **no** `opportunity_access` rows → visibility is purely
  by audience match.
- If an opportunity **has** `opportunity_access` rows → it is restricted to
  those LPs (still subject to audience match + approved status). This preserves
  the current granular-control capability without forcing per-LP grants on every
  deal.

(If the team prefers maximum simplicity, `opportunity_access` could be dropped
and visibility made purely audience-based — but keeping it as an optional
override costs nothing and retains flexibility. Recommendation: **keep it**.)

### 4A.4 Universal NDA: make it always-on, retire the per-deal toggle

Today the body gate is conditional on `opportunities.nda_required`. Under the
proposed model the NDA is **universal**:

- **RLS:** drop the `o.nda_required = false OR …` branch from the
  `opportunity_sections` policy so a signed NDA is **always** required to read
  the body (sketch in §4A.5).
- **Column:** **keep `nda_required` but default it `true` and remove the editor
  toggle.** Rationale: retaining the column gives us a documented, admin-only
  escape hatch (e.g., a future "open teaser pack" deal) without a migration, and
  avoids a destructive column drop. In practice it is always `true` and not
  surfaced in the editor. (Alternative: drop the column outright — cleaner but
  irreversible; **recommendation: keep + default true**.)
- **Title/teaser stay visible pre-NDA.** RLS gates *sections*, not the
  opportunity *row*, so an LP still sees what they're being asked to sign for.
  This is unchanged and is the intended behavior (confirmed against the existing
  policy split between `opportunities` and `opportunity_sections`).

### 4A.5 Revised RLS sketch

```sql
-- opportunities ROW: approved LP + published + audience match
--   (+ optional opportunity_access allowlist when present)
create policy "opportunities: lp read by audience"
  on public.opportunities for select
  using (
    exists (
      select 1 from public.lps
      where lps.profile_id = auth.uid() and lps.status = 'approved'
    )
    and published_at is not null
    and (
      audience = 'both'
      or (audience = 'insiders'  and public.current_lp_audience() = 'insider')
      or (audience = 'outsiders' and public.current_lp_audience() = 'outsider')
    )
    and (
      -- no explicit allowlist => audience alone governs
      not exists (
        select 1 from public.opportunity_access oa
        where oa.opportunity_id = opportunities.id and oa.revoked_at is null
      )
      -- else must be on the allowlist
      or exists (
        select 1 from public.opportunity_access oa
        where oa.opportunity_id = opportunities.id
          and oa.lp_id = public.current_lp_id()
          and oa.revoked_at is null
      )
    )
  );

-- opportunity_sections BODY: same visibility, NDA now ALWAYS required
create policy "opportunity_sections: lp read with universal nda gate"
  on public.opportunity_sections for select
  using (
    exists (
      select 1
      from public.opportunities o
      where o.id = opportunity_sections.opportunity_id
        and o.published_at is not null
        and exists (
          select 1 from public.lps
          where lps.profile_id = auth.uid() and lps.status = 'approved'
        )
        and (
          o.audience = 'both'
          or (o.audience = 'insiders'  and public.current_lp_audience() = 'insider')
          or (o.audience = 'outsiders' and public.current_lp_audience() = 'outsider')
        )
        and (
          not exists (
            select 1 from public.opportunity_access oa
            where oa.opportunity_id = o.id and oa.revoked_at is null
          )
          or exists (
            select 1 from public.opportunity_access oa
            where oa.opportunity_id = o.id
              and oa.lp_id = public.current_lp_id()
              and oa.revoked_at is null
          )
        )
        -- UNIVERSAL NDA: no nda_required escape hatch in the policy
        and exists (
          select 1 from public.opportunity_ndas n
          where n.opportunity_id = o.id
            and n.lp_id = public.current_lp_id()
            and n.status = 'signed'
        )
    )
  );
```

This is a near-mechanical edit of the existing policies in
`supabase/migrations/0001_rls_policies.sql` (lines 155–217): swap the
`visible_to_all_approved_lps`/access logic for the audience logic, and remove the
`nda_required = false` branch.

### 4A.6 What gets REMOVED (and why it's a security win)

Removed by this redesign:

- **`opportunities.password_protected`** column and the separate
  **`opportunity_access_passwords`** table (note: the password is stored in that
  dedicated table, not a `password_hash` column on `opportunities`).
- **`OpportunityPasswordGate`** component
  (`components/webflow/opportunity-password-gate.tsx`).
- **`unlockOpportunity`** server action (`app/opportunities/actions.ts`) and the
  guest interest path that depends on it.
- **The outsider signed-cookie machinery** in `lib/opportunity-access.ts` (both
  the access token and the 30-day "verified" token) and the
  `opportunityPasswordMatches` helper in `lib/opportunity-password.ts`.
- **The `lps.status = 'outsider'` value** (replaced by `lps.audience = 'outsider'`
  on real LP rows).
- **Crucially, the service-role section read for non-admins** on the detail page
  (`app/opportunities/[opportunityId]/page.tsx` ~line 622, the
  `viewerKind === 'lp' ? serverSupabase : supabase` branch).

**Why this is a major security win, not just cleanup:** today the detail page
has *three* viewer kinds (`admin`, `lp`, `guest`) and two read paths, and two of
the three (`admin`, `guest`) read sections via the **service-role client, which
bypasses RLS**. That means the NDA gate is, in practice, only enforced for real
session LPs. Removing the guest path makes **every non-admin viewer an
authenticated session user hitting RLS**, so:

- The universal-NDA rule is enforced in **exactly one place** (the
  `opportunity_sections` policy) instead of being re-implemented in app code.
- There is **no anonymous, cookie-based access** to gated bodies at all.
- The attack/Bug surface shrinks dramatically: no password brute-forcing, no
  cookie forgery questions, no "did we remember to check the NDA before the
  service-role read" footguns.

The only remaining service-role section read is the **admin preview** (§4A.7).

### 4A.7 Admin preview (the one allowed bypass)

Admins still need to see an opportunity body to build/QA it. Keep a single,
explicit admin path:

- Admins read sections via the service-role client (admin-all RLS would also
  permit it), **clearly labeled in-page**: "Admin preview — NDA not enforced."
- **Admin preview does NOT count as NDA satisfaction** and writes **no**
  `opportunity.viewed` LP audit row (consistent with today's behavior of only
  logging `lp`/`guest`).
- If an admin is *also* an LP on a deal and wants to experience the real gate,
  they go through the normal LP flow (sign the NDA); preview is explicitly the
  unenforced view.

### 4A.8 Migration plan

Additive, then destructive-in-a-later-step (so we can verify before dropping):

1. **Add columns/enums** (`lp_audience`, `opportunity_audience`, `lps.audience`,
   `opportunities.audience`) and the `current_lp_audience()` helper. Backfill:
   - Existing **approved invited LPs** → `audience = 'insider'` (they were the
     trusted, invited cohort).
   - Existing **`lps.status = 'outsider'`** rows → `audience = 'outsider'`. These
     have **no auth user** today, so they cannot view bodies under the new model
     until they authenticate. Treat them as **leads to (re)invite**: keep the
     row + interest history, and the new invite/onboarding flow turns them into
     authenticated outsider LPs. (Until they accept, they simply can't view —
     which is correct.)
   - Map **opportunity visibility:** `visible_to_all_approved_lps = true` →
     `audience = 'both'` (or `'insiders'` if "approved LPs" meant insiders only —
     **flag each such opportunity for admin confirmation**, do not silently
     guess). Password-protected opportunities were shared to outsiders → default
     `audience = 'outsiders'` (or `'both'`), **also flagged for admin review**.
2. **Swap RLS** to the §4A.5 policies; keep the old columns in place but unused.
3. **Repoint the detail page** to remove the guest path and read all non-admin
   sections via the RLS-bound session client; keep only the labeled admin
   preview.
4. **Remove the password UI/actions/cookies** (§4A.6) once (2)+(3) are verified.
5. **Drop** `password_protected`, `opportunity_access_passwords`, and retire the
   `outsider` status value in a final cleanup migration.
6. `opportunity_access` rows are **preserved** as the optional allowlist (§4A.3);
   no data migration needed beyond confirming intent.

**Unchanged:** admin promotion remains migration-only (no app path sets
`role='admin'`), and all money stays in `*_cents` bigint. This redesign touches
visibility/NDA, not those invariants.

### 4A.9 New open questions raised by this model

1. **Do admins viewing as preview need to sign?** Recommendation: **no** —
   preview is explicitly the unenforced view and is audit-flagged; admins sign
   only if they want to test the real LP flow.
2. **Can an LP be reclassified insider↔outsider, and what happens to their
   signed NDAs / access?** Recommendation: NDAs are keyed on
   `(opportunity_id, lp_id)`, **not** audience, so a signed NDA **survives
   reclassification** and stays valid for that opportunity. Reclassification
   only changes which *new* opportunities they can see (audience match);
   already-signed deals remain accessible if still audience-eligible. Define what
   happens if reclassification makes a previously-visible deal no longer match
   (recommend: row + body become hidden, but the historical NDA record and audit
   trail are retained).
3. **Should `'both'` audience exist?** Recommendation: **yes** (covers
   everyone-listings; replaces `visible_to_all_approved_lps`).
4. **Does universal NDA change the invite/onboarding flow?** Yes — outsiders can
   no longer "unlock" via password; they must be **invited and authenticate**.
   Confirm the onboarding flow can mint outsider-classified LP accounts and that
   the NDA step fits before first body view.
5. **Is there any opportunity that should be viewable without an NDA?** Confirm:
   under universal NDA, **no body** is viewable pre-NDA, but **title/teaser
   remain visible** (RLS gates sections, not the row). If a true "no-NDA teaser
   listing" is ever needed, that's the only reason to keep `nda_required` as an
   admin escape hatch (§4A.4).
6. **Outsider self-visibility scope:** should an outsider see *all* `outsiders`
   opportunities by default, or only those explicitly allowlisted via
   `opportunity_access`? (Ties to §4A.3; recommend audience-by-default with
   optional allowlist.)

---

## 5. Data Model Deltas

### 5.1 What already exists (reuse, do not duplicate)

On `opportunities`:

```223:226:db/schema.ts
  ndaRequired: boolean('nda_required').notNull().default(false),
  ndaTemplateId: text('nda_template_id'),
  watermarkEnabled: boolean('watermark_enabled').notNull().default(false),
  passwordProtected: boolean('password_protected').notNull().default(false),
```

The `opportunity_ndas` table already models a per-LP, per-opportunity signature
with provider, envelope id, status lifecycle, and signed-PDF storage key:

```298:311:db/schema.ts
export const opportunityNdas = pgTable('opportunity_ndas', {
  id: uuid('id').primaryKey().defaultRandom(),
  opportunityId: uuid('opportunity_id').notNull().references(() => opportunities.id, { onDelete: 'cascade' }),
  lpId: uuid('lp_id').notNull().references(() => lps.id, { onDelete: 'cascade' }),
  signatureProvider: text('signature_provider').notNull().default('dropbox_sign'),
  envelopeId: text('envelope_id').notNull(),
  status: signatureStatus('status').notNull().default('sent'),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  signedAt: timestamp('signed_at', { withTimezone: true }),
  signedDocumentStorageKey: text('signed_document_storage_key'),
}, (t) => ({
  uniqOpportunityLp: uniqueIndex('opportunity_ndas_opp_lp_idx').on(t.opportunityId, t.lpId),
  envelopeIdx: uniqueIndex('opportunity_ndas_envelope_idx').on(t.envelopeId),
}));
```

The `signatureStatus` enum (`sent|viewed|signed|declined|expired`) and the
`audit_action` enum values `nda.sent` / `nda.signed` already exist. RLS on
`opportunity_ndas` already allows admin read + LP read-own, with writes intended
via service role.

### 5.2 Provider default change + meaning of `nda_template_id` per provider

**Proposed migration (not code here):** `opportunity_ndas.signature_provider`
currently defaults to `'dropbox_sign'`:

```302:302:db/schema.ts
  signatureProvider: text('signature_provider').notNull().default('dropbox_sign'),
```

Change the default to **`'signatureapi'`** (and, if we later constrain it to an
enum/CHECK, make `'signatureapi'` the first/primary value with `'dropbox_sign'`,
`'docsend'`, `'documenso'` retained). It stays a `text` column so the provider
remains pluggable without further migrations.

`nda_template_id` is the admin's "select which document is the NDA" field.
**Key change for SignatureAPI:** unlike Dropbox Sign, SignatureAPI has **no
hosted, listable Template resource with an id**. Reuse is via a DOCX/PDF source
file in the SignatureAPI **Library** (referenced by a stable URL) with
`{{merge}}` (dynamic content) and `[[place]]` (signature/field position)
markers. There is nothing to "list," so the admin dropdown must be backed by a
**Speevy-owned catalog table** (`nda_templates`, §5.3). Therefore:

- **Repurpose `opportunities.nda_template_id`** to hold the **`nda_templates.id`**
  (a Speevy catalog row), **not** a provider-side id. The catalog row carries the
  provider-specific source reference.

| `signature_provider` | What the NDA source is | Where `nda_template_id` points |
|---|---|---|
| `signatureapi` (v1) | DOCX/PDF in SignatureAPI **Library** (stable URL) or stored upload, with `{{merge}}`/`[[place]]` markers | **`nda_templates.id`** (Speevy catalog row that stores `source_file_url` + fields config) |
| `dropbox_sign` (alt) | Dropbox Sign hosted **template id** | Could point at an `nda_templates` row whose config stores the Dropbox template id, or directly at the template id |
| `docsend` (alt) | DocSend **link/space identifier** | DocSend link/space ref |
| `documenso` (future) | Documenso template id | Documenso UI |

### 5.3 Proposed additions

#### `nda_templates` — the Speevy-owned NDA catalog (NEW, required for v1)

Because SignatureAPI exposes no listable template API, Speevy owns the catalog
the admin dropdown reads from:

```
nda_templates (
  id uuid pk default gen_random_uuid(),
  name text not null,                     -- admin-facing label, e.g. "Standard Mutual NDA v2"
  signature_provider text not null default 'signatureapi',
  source_file_url text not null,          -- SignatureAPI Library URL (or stored-upload ref)
  fields_config jsonb not null default '{}', -- {{merge}} fields + [[place]] positions / recipient roles
  version integer not null default 1,
  archived_at timestamptz,                -- soft-disable; never hard delete (audit)
  created_by_profile_id uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)
```

- `opportunities.nda_template_id` references an `nda_templates.id` (a published,
  non-archived row).
- Admin-managed via admin-only Server Actions (§7); admin-read RLS, no LP access.
- Versioning: bump `version` (or create a new row) when the NDA text changes, so
  historical `opportunity_ndas` remain attributable to the exact NDA signed.

#### `opportunity_ndas` correlation key

`opportunity_ndas.envelope_id` is already `NOT NULL UNIQUE`. We reuse it as the
**per-attempt correlation key**:

- **SignatureAPI (v1):** `envelope_id` = SignatureAPI **envelope id**. Even
  though `envelope_metadata` echoes `(opportunity_id, lp_id)` on every event
  (so mapping needs no lookup), we **still persist the envelope id** for
  idempotency, support, and audit cross-reference.
- **Dropbox Sign (alt):** `envelope_id` = `signature_request_id`.
- **DocSend (alt):** `envelope_id` = a Speevy-generated mapping token (UUID), as
  DocSend gives no envelope id up front.

Recommended **new columns** (one small migration; additive, nullable):

| Column | Table | Purpose |
|---|---|---|
| `last_webhook_event_id text` | `opportunity_ndas` | Idempotency: last processed provider event id; reject duplicates |
| `provider_account_ref text` | `opportunity_ndas` *(or `nda_templates`)* | Which provider account/Library the NDA source lives under |
| `declined_at timestamptz` / `expired_at timestamptz` | `opportunity_ndas` | Lifecycle timestamps to match the status enum (optional but tidy) |

`opportunity_ndas.signed_document_storage_key` **already exists** and is exactly
where we store the SignatureAPI Deliverable (sealed PDF) after
`deliverable.generated` (see §6.1).

#### `nda_webhook_events` — idempotency + (DocSend) reconciliation

Recommended **new table** for robust idempotency across providers; doubles as the
DocSend reconciliation queue (alt path only):

```
nda_webhook_events (
  id uuid pk default gen_random_uuid(),
  provider text not null,                 -- signatureapi | dropbox_sign | docsend
  provider_event_id text,                 -- Standard Webhooks event id / Dropbox event id / synthesized (DocSend)
  event_type text,                        -- recipient.completed | envelope.completed | deliverable.generated | ...
  opportunity_nda_id uuid references opportunity_ndas(id),  -- resolved via envelope_metadata (SignatureAPI) or lookup
  signer_email text,                      -- DocSend mapping only; SCRUBBED from logs
  document_ref text,                      -- DocSend link/space id (alt)
  status text not null default 'received',-- received | applied | unmatched | duplicate
  raw_payload jsonb,                      -- minus PII where feasible
  received_at timestamptz not null default now(),
  unique (provider, provider_event_id)
)
```

For **SignatureAPI** mapping is direct (via `envelope_metadata`), so events go
straight to `applied`; `unmatched` is essentially a DocSend-only concern. The
table's primary v1 job is the **idempotency anchor** (`unique (provider,
provider_event_id)`), independent of `opportunity_ndas`.

---

## 6. Webhook / Ingestion Design

All webhook routes are **new** (none exist today; the only non-page route
handler is `app/admin/investors/bulk-approve/route.ts`). All use the
service-role client `lib/supabase/admin.ts` **only after** authenticating the
request, per `.cursorrules`.

### 6.1 SignatureAPI — `app/api/webhooks/signatureapi/route.ts` *(primary, v1)*

- **Auth:** verify the **Standard Webhooks** signature on the `webhook-signature`
  header using the **`standardwebhooks`** library + the signing secret. Reject on
  mismatch (401). Validate on the **first lines**, before any service-role use.
- **Mapping (clean):** read `(opportunity_id, lp_id)` from the **`envelope_metadata`**
  echoed on every event — **no separate lookup strictly required**. Still
  cross-check against the persisted `opportunity_ndas.envelope_id` for defense in
  depth.
- **Idempotency:** insert into `nda_webhook_events` keyed on
  `(provider='signatureapi', provider_event_id)`; on conflict → `duplicate`,
  200, no-op.
- **State machine** (SignatureAPI statuses → existing
  `signature_status` enum `sent|viewed|signed|declined|expired`):
  - envelope created / sent → `sent`
  - recipient viewed/opened ceremony → `viewed`
  - **`recipient.completed`** (single required signer) / **`envelope.completed`**
    (all recipients done) → **`signed`** (the unlock trigger; key off
    `envelope.completed` so countersignature stays non-breaking — §3a)
  - recipient declined / envelope canceled → `declined`
  - envelope expired → `expired`
- **On `deliverable.generated`:** `GET deliverable` → **1-hour pre-signed URL**;
  download the **sealed signed PDF + audit log** and upload to a **private**
  Supabase Storage bucket; set `signed_document_storage_key` (column already
  exists) and `signed_at`. Serve only via short-lived signed URLs (mirror the
  1-hour asset pattern on the detail page).
- **Transactional audit:** write the `opportunity_ndas` upsert + `audit_log`
  (`nda.sent` / `nda.signed`) in the **same DB transaction**.
- **Edge cases:** `envelope.completed` may arrive before/after
  `deliverable.generated`; flip the gate on completion and attach the PDF when
  the deliverable lands (two events, idempotent). A late completion after
  `expired` transitions to `signed` with an audit note.

### 6.2 Dropbox Sign — `app/api/webhooks/dropbox-sign/route.ts` *(Alternative / Future)*

- **Auth:** verify the Dropbox Sign **HMAC** (`event_hash = HMAC-SHA256(api_key,
  event_time + event_type)`). Reject on mismatch (401). Dropbox Sign also
  requires echoing `Hello API Event Received` for the test ping.
- **Idempotency:** insert into `nda_webhook_events` keyed on
  `(provider, provider_event_id)`; on conflict → `duplicate`, 200, no-op.
- **State machine:** map events →
  `signature_request_sent` → `sent`,
  `signature_request_viewed` → `viewed`,
  `signature_request_signed` (one signer) → keep `sent`/`viewed`,
  `signature_request_all_signed` → **`signed`** (the unlock trigger),
  `signature_request_declined` → `declined`,
  `signature_request_expired` → `expired`.
- **Mapping:** via a stored `signature_request_id` → `(lp, opportunity)` record
  (no metadata echo like SignatureAPI).
- **On `signed`:** fetch the executed PDF via API, upload to Supabase Storage
  (private bucket), set `signed_document_storage_key`, set `signed_at`.
- **Transactional audit:** same as §6.1.

### 6.3 DocSend via Zapier relay — `app/api/webhooks/docsend/route.ts` *(Alternative / Future)*

- **Auth:** **shared-secret** header (Zapier Webhook action sends a fixed bearer/
  HMAC of body with a secret only Speevy + the Zap know). Constant-time compare.
- **Payload:** `{ signer_email, signer_name, document_ref (link/space id),
  signed_at, [mapping_token] }`.
- **Mapping** `(event) → (lp_id, opportunity_id)`:
  1. `document_ref` → the opportunity whose `nda_template_id` matches (requires
     **one DocSend link per opportunity** convention).
  2. `signer_email` → an `lps` row (invited LP) for that opportunity's access.
     Ideally a **per-LP link** makes this exact; otherwise match by email.
  3. If both resolve uniquely → upsert `opportunity_ndas` to `signed` + audit.
  4. If ambiguous / email not found / multiple matches → park in
     `nda_webhook_events` as `unmatched` for **manual admin reconciliation**.
- **Idempotency:** synthesize `provider_event_id` from
  `hash(document_ref + signer_email + signed_at)` when Zapier doesn't supply one.

### 6.4 DocSend via inbound-email — `app/api/webhooks/docsend-inbound/route.ts` *(Alternative / Future)*

- **Auth:** provider (Postmark/SendGrid) inbound-parse webhook secret + verify
  the message was delivered to the dedicated owner inbox; verify sender domain is
  DocSend's. Reject otherwise.
- **Parse:** extract `signer_email`, document identity, and (if present) the
  signature-certificate attachment from the DocSend "signed copy" email.
- **Mapping + idempotency:** identical to §6.2, but treat as **best-effort**:
  email delay/spam/template changes are expected. Always pair with the manual
  backstop. Synthesize `provider_event_id` from message-id.

### 6.5 Cross-cutting

- **No LP PII in logs / PostHog / error reports** — scrub `signer_email`/name
  before any log line or analytics event (per `.cursorrules`).
- **Service-role only after auth** — every route validates signature/secret on
  the **first lines**, before touching `createSupabaseAdminClient()`.
- **Edge cases:** (SignatureAPI) completion vs deliverable event ordering is
  idempotent (§6.1); (DocSend alt) email mismatch → `unmatched` queue, signer who
  isn't an invited LP → `unmatched` (do not auto-create access); duplicate
  events → `duplicate`; late all-signers event after `expired` → transition to
  `signed` with an audit note.

---

## 7. Server Action Design

Colocated per convention. Admin actions live in
`app/admin/opportunities/actions.ts`; LP-facing NDA actions in
`app/opportunities/actions.ts` (alongside `unlockOpportunity` /
`saveOpportunityInterest`).

### 7.1 Persist `nda_template_id` (+ provider) from the editor

`saveOpportunity` already persists `nda_required` but **drops the template id**:

```49:52:app/admin/opportunities/actions.ts
  ndaRequired: z.boolean(),
  watermarkEnabled: z.boolean(),
  passwordProtected: z.boolean(),
  password: z.string().optional(),
```

```292:294:app/admin/opportunities/actions.ts
    nda_required: data.ndaRequired,
    watermark_enabled: data.watermarkEnabled,
    password_protected: data.passwordProtected,
```

**Add** `ndaTemplateId` (pointing at an `nda_templates.id`) + `ndaProvider`
(defaulting to `'signatureapi'`) to the Zod schema and the persisted fields, with
a **cross-field refinement**: if NDA is required then `ndaTemplateId` must
reference a published, non-archived `nda_templates` row; if Option 1 (§4.4) is
chosen, also refine `!(ndaRequired && passwordProtected)`. First line still
validates admin role (as the existing action does).

### 7.1b Admin catalog actions — manage `nda_templates`

Admin-only Server Actions (first line validates admin role) to run the catalog
the editor dropdown reads from:

- `createNdaTemplate({ name, sourceFileUrl, fieldsConfig, provider })` — register
  a SignatureAPI Library file (or stored upload) as a catalog row.
- `updateNdaTemplate` / `archiveNdaTemplate` — edit/soft-disable; never hard
  delete (preserve attribution for already-signed `opportunity_ndas`).
- `listNdaTemplates` — non-archived rows for the editor dropdown.

These do **not** call SignatureAPI to "create a template" (there is no such
resource); they record the Speevy-side reference to a source file the admin
prepared and uploaded to the Library (§9 workflow).

### 7.2 `createOpportunityNdaEnvelope()` + `getNdaCeremonyUrl()` — SignatureAPI (embedded)

- Validate caller is an approved session LP (`current_lp_id()`), has access to
  the opportunity, and the NDA is required.
- Resolve the opportunity's `nda_template_id` → `nda_templates` row → its
  `source_file_url` + `fields_config`.
- If no `opportunity_ndas` row for `(opportunity, lp)`: **create a SignatureAPI
  envelope** from the source file with the LP as recipient, `delivery_type:
  none`, `embeddable_in` whitelisting the Speevy origin, and **`envelope_metadata:
  { opportunity_id, lp_id }`**. Upsert `opportunity_ndas` (`status='sent'`,
  `envelope_id = <SignatureAPI envelope id>`, `signature_provider='signatureapi'`)
  via service role; write `nda.sent` audit row in the same txn.
- Return the **recipient ceremony URL** for embedding (the client appends
  `&embedded=true&event_delivery=message`). `getNdaCeremonyUrl()` can be the
  idempotent entry point that creates-if-missing then returns the URL.

### 7.3 `startDocSendNda()` — DocSend (redirect) *(Alternative / Future)*

- Same validation as 7.2.
- Mint a mapping token (UUID), upsert `opportunity_ndas` (`status='sent'`,
  `envelope_id = token`, `signature_provider='docsend'`), write `nda.sent`.
- Return the opportunity's DocSend link for the client to open in a new tab.
  Completion arrives later via §6.3/§6.4.

### 7.4 `getNdaStatus()` — poll helper

- Returns the caller's `opportunity_ndas.status` for the opportunity so the gate
  component can poll for `signed` and then `router.refresh()`. Reads via the
  RLS-bound session client (LP can read own row). The webhook (§6.1) is the
  source of truth; the SignatureAPI `event_delivery=message` event is only a UX
  cue to trigger a refresh.

All actions return discriminated-union results
(`{ status: 'success' | 'error', ... }`) matching the existing action style.

---

## 8. LP-Facing UX

New component **`components/webflow/opportunity-nda-gate.tsx`**, distinct from
`components/webflow/opportunity-password-gate.tsx`. The password gate is for
shared-link outsiders and is **orthogonal**; do not overload it.

Key UX states:

- **Teaser-visible gate (default):** The opportunity row (title, teaser) is
  always visible to an LP with access — RLS gates *sections*, not the row, so the
  LP knows what they're being asked to sign for. The gate renders the teaser plus
  a **"Review & sign NDA"** CTA, and a blocked-body empty state where sections
  would be.
- **SignatureAPI (embedded ceremony — v1):** CTA calls `getNdaCeremonyUrl()`,
  then renders the **ceremony URL in an iframe** with
  `&embedded=true&event_delivery=message`. The in-page `message` event is a
  **UX cue only** (e.g. to flip to "pending confirmation" / trigger a refresh) —
  **the §6.1 webhook is the source of truth** for `signed`. Never unlock the
  body off the client message alone.
- **DocSend (redirect — alt/future):** CTA calls `startDocSendNda()` and opens
  the DocSend link in a **new tab** (no embed — `X-Frame-Options: SAMEORIGIN`).
- **Pending / poll-for-completion:** after the ceremony, poll `getNdaStatus()`
  (or `router.refresh()`) until status is `signed`. Because completion is
  webhook-driven and can lag slightly, show an honest "We're confirming your
  signature — this can take a moment" state with a manual "I've signed" refresh
  and a fallback contact line.
- **Post-sign unlock:** sections render; if `watermark_enabled`, the existing
  `PageWatermark` (LP email + tiled, low opacity) applies. Keep the watermark
  copy honest: deterrent/attribution, not screenshot prevention.

The gate component is a client component receiving typed props (provider, CTA
copy, opportunity slug, current status) from the server detail page — no
client-side fetching of opportunity data, per `.cursorrules`.

---

## 9. Admin UX

Extend the existing editor `components/webflow/opportunity-editor.tsx`. The
"Require NDA" toggle already exists in the Opportunity Settings card:

```2453:2462:components/webflow/opportunity-editor.tsx
                  <div className="fieldblock">
                    <CheckboxRow
                      label="Require NDA"
                      checked={ndaRequired}
                      onChange={(checked) => {
                        setNdaRequired(checked);
                        markDirty();
                      }}
                    />
                  </div>
```

**Add, directly beneath the toggle, conditional on `ndaRequired === true`:**

1. **NDA document dropdown** — a `<Select>` populated from the **Speevy
   `nda_templates` catalog** (`listNdaTemplates`, non-archived). Maps to
   `opportunities.nda_template_id` (→ `nda_templates.id`). This is **not** a live
   provider "list templates" call — SignatureAPI exposes no such API; the
   dropdown reads Speevy's own catalog.
2. **Validation** — block save when NDA is required and no template selected
   (client + the §7.1 Zod refinement). If Option 1 (§4.4), keep NDA and
   password-protected mutually exclusive.

Keep it visually within the existing Webflow `cardblock`/`fieldblock` markup;
the dropdown can be a shadcn `Select` styled to match.

#### Admin NDA-template workflow (catalog management)

Because SignatureAPI reuse is file-based (no hosted template id), registering a
new NDA is a short, explicit workflow:

1. **Prepare the document offline** — author the NDA as a DOCX/PDF and add
   **`{{merge}}`** placeholders for dynamic content (e.g. LP name, date) and
   **`[[place]]`** placeholders for signature/field positions.
2. **Upload to the SignatureAPI Library** — store it permanently there; copy its
   **stable source-file URL** (or use the "store an upload" API reference).
3. **Register it in Speevy** — via the admin catalog UI (`createNdaTemplate`),
   creating an `nda_templates` row (`name`, `source_file_url`, `fields_config`,
   `version`). Now it appears in the opportunity editor dropdown.

A dedicated admin **"NDA Templates"** management view (list / add / edit /
archive, never hard-delete) backs this. The opportunity editor only *selects*
from the catalog; it never edits source files.

For the DocSend alternative only, an **NDA reconciliation** panel (list
`nda_webhook_events` with `status='unmatched'`, manually attach to the correct
`(lp, opportunity)`) would be the manual backstop — not needed for SignatureAPI,
whose `envelope_metadata` maps events directly.

---

## 10. Security & Compliance (per `.cursorrules`)

- **Reg D 506(b) posture:** NDAs are tied to **invited, identifiable LPs**. This
  is the core reason Option 1 (§4.4) — no NDA on anonymous password-shared
  links — is recommended: a compliance signature needs an attributable signer.
- **Audit logging:** every NDA lifecycle event writes `nda.sent` / `nda.signed`
  (enums already exist) in the **same transaction** as the `opportunity_ndas`
  write. Every LP body read continues to write `opportunity.viewed` (already done
  for `lp`/`guest` on the detail page). Admin previews are flagged and not logged
  as LP views.
- **No LP PII in logs / PostHog / error reports:** scrub `signer_email`, names,
  and certificate contents before any log/analytics/error path. `nda_webhook_events.raw_payload`
  stores the minimum needed for reconciliation and should be access-restricted
  (admin-only RLS), never surfaced to analytics.
- **Signed-URL-only document access:** executed NDA PDFs live in a **private**
  Supabase Storage bucket; access only via short-lived signed URLs (reuse the
  1-hour signed-URL pattern already used for opportunity assets). No public
  buckets.
- **Service-role discipline:** the service-role client is used **only** inside
  webhook handlers (after signature/secret validation) and inside admin-only
  Server Actions (admin role checked first line), per the existing pattern in
  `app/admin/opportunities/actions.ts`. Never shipped to the browser.
- **No admin-role escalation path:** unchanged; this feature touches no
  `profiles.role` writes.

### Vitest + RLS test plan

Simulate **LP** and **admin** DB connections (set the JWT claims / `auth.uid()`)
and assert:

1. **Gate closed:** `nda_required = true`, no signed NDA → LP SELECT on
   `opportunity_sections` returns **zero rows**; the opportunity *row* (title,
   teaser) is still visible.
2. **Gate open:** insert `opportunity_ndas` (`status='signed'`) for that
   `(lp, opportunity)` → LP SELECT on sections now returns rows.
3. **Wrong LP:** a signed NDA for LP A does **not** unlock sections for LP B.
4. **Status partial:** `sent`/`viewed`/`declined`/`expired` do **not** unlock;
   only `signed` does.
5. **Admin:** admin SELECT on sections always returns rows (admin-all policy),
   and the detail page renders the "admin preview" banner when gated.
6. **opportunity_ndas isolation:** LP can read own NDA rows only; cannot read
   another LP's; cannot INSERT/UPDATE (writes are service-role only).
7. **Webhook idempotency:** posting the same provider event twice (same
   Standard Webhooks event id) yields one `opportunity_ndas` transition and one
   audit row; second is `duplicate`.
8. **SignatureAPI mapping correctness:** an `envelope.completed` event whose
   `envelope_metadata` carries `(opportunity_id, lp_id)` flips exactly that
   `(lp, opportunity)` gate and no other; a forged/mismatched signature is
   rejected before any write. (DocSend alt: unknown email parks as `unmatched`
   and flips nothing.)
9. **Server-action authz:** `createOpportunityNdaEnvelope`/`getNdaCeremonyUrl`
   reject callers without access; catalog actions and `saveOpportunity` reject
   non-admins and enforce the template-required + (Option 1) NDA⊕password
   refinements.
10. **Guest path (if Option 2):** a password guest without a signed NDA cannot
    read sections even though the read uses the service-role client (explicit
    app-layer check).

---

## 11. Phased Implementation Plan & Open Questions

v1 builds toward **SignatureAPI only**. The access-model redesign (§4A) is
sequenced as its own track because it is still **pending user confirmation** —
the SignatureAPI engine (Track 1) can ship on today's access model and does not
*block* on §4A, but §4A is what makes the universal-NDA rule clean.

> **Gate before Track 1 go-live:** complete the SignatureAPI due-diligence
> checklist (below). Building against the free test tier can start immediately.

#### Track 1 — SignatureAPI NDA gate (committed; build now)

1. **PR 1 — `nda_templates` catalog + admin management.**
   Migration for `nda_templates`; admin actions (`create/update/archive/list`)
   and a minimal admin "NDA Templates" view. Tests: admin-only access; archive
   preserves attribution.
2. **PR 2 — Editor wiring.**
   Add the NDA-document dropdown (reads `nda_templates`) + `ndaTemplateId` /
   `ndaProvider` (default `'signatureapi'`) to the editor and `saveOpportunity`
   Zod schema + persisted fields. Tests: save round-trips template ref; reject
   NDA-on with no template.
3. **PR 3 — `opportunity_ndas` write plumbing + idempotency table.**
   Migration for `nda_webhook_events` + new columns (§5.3); flip
   `signature_provider` default → `'signatureapi'`. Service-role upsert helpers +
   transactional audit writes. Tests: idempotency, audit rows.
4. **PR 4 — SignatureAPI engine end-to-end.**
   `createOpportunityNdaEnvelope` / `getNdaCeremonyUrl`, embedded ceremony in
   `OpportunityNdaGate`, `app/api/webhooks/signatureapi/route.ts` (Standard
   Webhooks HMAC + status mapping + `envelope_metadata` mapping +
   `deliverable.generated` → sealed PDF to Storage). Unlock keys off
   `envelope.completed` so countersignature is non-breaking later. Env config:
   **test-mode vs live keys** + signing secret. Tests: webhook signature,
   `envelope.completed` → unlock, deliverable stored, RLS gate flip.
5. **PR 5 — LP gate UX polish + poll/refresh.**
   `OpportunityNdaGate` pending/poll state (with `event_delivery=message` cue),
   blocked-body empty state, watermark note.

#### Track 2 — Access-model redesign (PROPOSED; build only after user confirms §4A)

6. **PR 6 — Add audience model (additive).**
   `lp_audience` + `opportunity_audience` enums, `lps.audience`,
   `opportunities.audience`, `current_lp_audience()`; backfill per §4A.8 step 1.
   No behavior change yet. Tests: backfill correctness; helper returns audience.
7. **PR 7 — Swap RLS + make NDA universal.**
   Replace the `opportunities`/`opportunity_sections` policies with the §4A.5
   audience + universal-NDA policies; default `nda_required = true` and drop the
   editor toggle. Tests: audience-match visibility, body always NDA-gated,
   title/teaser still visible pre-NDA.
8. **PR 8 — Remove the guest path + service-role bypass; add admin preview.**
   Repoint the detail page so all non-admin reads use the RLS-bound session
   client; add the labeled admin-preview path (§4A.7). Tests: no anonymous body
   access; admin preview flagged + unaudited as LP view.
9. **PR 9 — Delete password mechanism.**
   Remove `OpportunityPasswordGate`, `unlockOpportunity`, the
   `lib/opportunity-access.ts` cookie machinery, `lib/opportunity-password.ts`;
   final migration drops `password_protected` + `opportunity_access_passwords`
   and retires the `outsider` status value (§4A.6/§4A.8). Tests: routes/actions
   gone; no regressions.

#### Future (not scheduled) — alternative engines

10. **Dropbox Sign / DocSend / DocuSign / etc.** slot in behind
    `signature_provider` only if SignatureAPI falters or a deal demands DocSend's
    deck analytics (then prefer the hybrid). DocSend bridge (Zapier relay +
    reconciliation UI / inbound-email) per §3c / §6.3–6.4.

### Open questions (need user/business decisions)

**Engine / signing:**

1. **Countersignature — required?** *Undecided (deferred).* SignatureAPI supports
   it via the `recipients` array (parallel/sequential); the design is already
   non-breaking for adding a Harpoon countersigner later (unlock keys off
   `envelope.completed`). No action needed unless/until the team wants it.

**SignatureAPI-specific (confirm before/at go-live):**

2. **Vendor due diligence:** obtain SignatureAPI's **SLA**, **SOC 2 Type II
   report**, and a signed **DPA** before go-live (vendor is young — founded 2023,
   GA Oct 2024). See the checklist below.
3. **Data residency:** where does SignatureAPI store envelopes, ceremonies, and
   Deliverables (region)? Acceptable for our LPs / counsel?
4. **Vendor longevity / exit plan:** confirm we can export executed PDFs + audit
   logs and that `signature_provider` pluggability gives us a realistic swap to
   Dropbox Sign/DocuSign if needed.
5. **NDA source files:** where do the master DOCX/PDF source files live
   (SignatureAPI Library vs a Speevy-controlled copy), and **who owns/maintains
   the `{{merge}}` / `[[place]]` markers** when the NDA text changes?
6. **Test vs live keys:** env-config strategy for SignatureAPI **test-mode vs
   live** keys + the Standard Webhooks signing secret across local / preview /
   production (Vercel env), with no secrets in the client.

**DocSend (parked — future only):** if ever revisited — Zapier as a data
processor, the plan tier that exposes the "New signed document" trigger, and
per-opportunity vs per-LP links.

**Access-model redesign (§4A) — confirm before Track 2:**

3. **Commit to the insider/outsider + universal-NDA model?** This is the gating
   decision for Track 2.
4. **Do admins previewing need to sign?** Recommendation: no (§4A.9.1).
5. **Insider↔outsider reclassification:** what happens to signed NDAs/access?
   Recommendation: NDAs survive (keyed on lp+opportunity); visibility follows
   the new audience (§4A.9.2).
6. **Keep the `'both'` audience value?** Recommendation: yes (§4A.9.3).
7. **Does universal NDA change invite/onboarding?** Yes — outsiders must be
   invited + authenticate (no more password unlock). Confirm onboarding mints
   outsider-classified accounts (§4A.9.4).
8. **Any opportunity viewable without an NDA?** Confirm "no body without NDA;
   title/teaser stay visible." Keep `nda_required` as an admin escape hatch only
   if a true no-NDA teaser listing is needed (§4A.9.5).
9. **Keep per-LP `opportunity_access` as an optional allowlist, or drop it?**
   Recommendation: keep as optional narrowing override (§4A.3).

### Pre-go-live due-diligence checklist — SignatureAPI

Complete before Track 1 ships to production (building on the free test tier can
start now). Because the vendor is young (founded 2023, GA Oct 2024), this is
non-optional for a Reg D 506(b) money product.

- [ ] **SLA** — obtain the production uptime/availability SLA and incident/
      support terms in writing.
- [ ] **SOC 2 Type II report** — request and review the current report (not just
      the badge); confirm scope covers the signing + storage services we use.
- [ ] **DPA** — execute a Data Processing Agreement (we send LP PII: name,
      email, executed NDAs).
- [ ] **Data residency** — confirm storage region(s) for envelopes, ceremonies,
      and Deliverables; confirm acceptable to counsel.
- [ ] **Compliance claims** — get written confirmation of ESIGN / UETA /
      eIDAS-SES conformance and the audit-log contents of the Deliverable.
- [ ] **Exit / portability** — confirm bulk export of executed PDFs + audit logs
      and document the swap path to Dropbox Sign/DocuSign via
      `signature_provider`.
- [ ] **Webhooks** — confirm Standard Webhooks signing-secret rotation, retry/
      redelivery behavior, and event catalog (`recipient.completed`,
      `envelope.completed`, `deliverable.generated`).
- [ ] **Embedding** — confirm `embeddable_in` origin whitelisting + ceremony
      `event_delivery=message` behavior for our domains (incl. preview URLs).
- [ ] **Keys/env** — confirm test-mode vs live key separation and rate limits.

### Questions for alternative-engine sales (only if SignatureAPI is dropped)

> - **Dropbox Sign:** confirm current **embedded signing**, **templates**, **HMAC
>   webhook** (`signature_request_all_signed`), **countersignature**, and
>   **audit-trail PDF** availability + the **Enterprise plan tier / sales
>   timeline** and pricing on the API plan we'd use.
> - **DocSend:** does it offer a documented **developer REST API** and
>   **developer-registered webhooks** (not via Zapier) for "signed" events; is
>   there an Enterprise-only API; does the **Zapier "New signed document"
>   trigger** fire reliably; can a completion payload carry a **passthrough
>   token** for correlation?

---

## Appendix — Orthogonal systems (do not conflate)

- **Password gate** (`OpportunityPasswordGate`, `unlockOpportunity`, outsider
  `lps.status='outsider'`, signed cookies via `lib/opportunity-access.ts`,
  `lib/opportunity-password.ts`) is today's **shared-direct-link** mechanism,
  independent of the NDA gate. **Under the proposed §4A redesign this entire
  mechanism is removed** and replaced by authenticated insider/outsider LPs +
  audience-based visibility. Until §4A is confirmed/landed, it remains live and
  orthogonal to the NDA gate.
- **Watermark** (`PageWatermark`, `opportunities.watermark_enabled`) is a
  deterrent/attribution tool, applied after unlock — not a gate.

> **Note on alternative-engine specifics:** the Dropbox Sign webhook (§6.2), the
> `startDocSendNda` action (§7.3), the DocSend webhook/ingestion designs
> (§6.3–6.4), and the DocSend reconciliation admin UI (§9) are
> **Alternative/Future** — retained for completeness but **not part of the v1
> (SignatureAPI) build**. v1 implements only: the SignatureAPI actions
> `createOpportunityNdaEnvelope` / `getNdaCeremonyUrl` (§7.2) + admin catalog
> actions (§7.1b), the poll helper (§7.4), the SignatureAPI webhook (§6.1), the
> `nda_templates` catalog + dropdown (§5.3, §9), and the embedded ceremony (§8).

