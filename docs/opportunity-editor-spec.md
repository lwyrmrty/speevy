# Opportunity Editor Implementation Spec

Captured from the Webflow `edit-opportunity.html` walkthrough. Preserve Webflow markup/classes for the static pass, then wire fields to typed data, Server Actions, and RLS.

## Status

- UI: sidebar dropdown, closed state is `dropdownbuttons _100 w-inline-block`; hidden menu is `dropdownmodal short`.
- Options are pill selectors: `Draft`, `Potential`, `Active`, `Past`.
- Behavior: clicking an option updates the visible pill and persists the opportunity status.
- Backend: update `opportunity_status` enum from `potential | upcoming | active | past` to `draft | potential | active | past`.

## Opportunity Info

These fields feed the live hero preview (`herocard` / `herooverlay`) in the main editor pane.

- `Opportunity Name`
  - Webflow input: `#Opportunity-Title`, `formfields w-input`.
  - Backend: `opportunities.title`.
  - Can be used to default `opportunities.slug`.
- `Thumbnail`
  - Webflow picker: `thumbnailpicker wide`.
  - Backend: add `opportunities.thumbnailStorageKey` text.
  - Used in admin list rows, LP-facing opportunity cards/lists, and any compact opportunity references.
- `Logo`
  - Webflow picker: `thumbnailpicker`.
  - Backend: add `opportunities.logoStorageKey` text.
  - Used in the opportunity hero and compact identity contexts.
- Image upload behavior
  - Both `thumbnailpicker wide` and `thumbnailpicker` are clickable upload fields.
  - Upload image from the admin's computer to Supabase Storage and store the resulting storage key on the opportunity.
  - Serve images back through short-lived signed URLs; no public buckets.
- `Short Description`
  - Webflow textarea: `#Photos-Description`, `formfields _70 w-input`.
  - Backend: `opportunities.teaser`.
- `Opportunity Stage`
  - Plain text input, placeholder `e.g. Pre-Seed`.
  - Backend: add `opportunities.stage` text.
  - Render in hero stat pill as `Stage: Pre-Seed`.
- `Amount to be Raised`
  - Money input, placeholder `e.g. $2,500,000`.
  - Backend: existing `opportunities.targetAllocationCents`.
  - Store as bigint cents; display with `$` prefix and comma formatting.
- `Minimum Check Size`
  - Money input, placeholder `e.g. $100,000`.
  - Backend: existing `opportunities.minimumInvestmentCents`.
  - Store as bigint cents; display with `$` prefix and comma formatting.
  - Later interest flow must require indicated amount >= this value.
- `Carry %`
  - Percentage input, placeholder `e.g. 15%`.
  - Backend: add `opportunities.carryPercentageBasisPoints` integer.
  - Store as basis points (`15%` -> `1500`).
- `Management Fee`
  - Optional percentage input, placeholder `e.g. 25%`.
  - Backend: add nullable `opportunities.managementFeeBasisPoints` integer.
  - Blank/null displays as `No Fee`; otherwise display formatted percent.

## Hero Preview

- UI: `herocard` containing `herooverlay`.
- This is a live preview of the `Opportunity Info` sidebar fields.
- Preview mappings:
  - logo picker -> `herologo`.
  - `Opportunity Name` -> `heroheading`.
  - `Short Description` -> `herosubheading`.
  - `Amount to be Raised` -> first pill, e.g. `$2.5 Million`.
  - `Carry %` -> second pill, e.g. `15% Carry`.
  - `Management Fee` -> third pill, e.g. `No Fee` when blank/null.
  - `Opportunity Stage` -> `Stage: Pre-Seed`.
  - `Minimum Check Size` -> `Min: $100k`; keep the fixed `Min:` label and swap only the formatted dollar amount.

## Section Cards

- UI: main editor `rowcards`.
- Each `rowcard verticaldown` is one section in the opportunity.
- The Webflow export shows all section types already added so we can see their designs; in the real editor, admins will add/remove/duplicate/reorder these.
- Default state: a new opportunity has no section cards.
- `New Content Block` (`bulkaction-button tall`) appends a new section card.
- Newly-added cards default to the `Rich Text` type. Admins can then use the card type dropdown to choose a different content type.
- Backend mapping: each card maps to one `opportunity_sections` row.
  - `opportunity_sections.type` stores the section type.
  - `opportunity_sections.position` stores the row order.
  - `opportunity_sections.data` stores that section's structured config/content.
- Current visible section card types in the export:
  - `Links`
  - `Media`
  - `Documents`
  - `Team`
  - `Investors`
- Shared card behaviors:
  - drag handle (`draggingblock`) lets admins drag-and-drop reorder cards; this updates `opportunity_sections.position` and therefore the order sections render on the LP-facing opportunity page.
  - top dropdown changes section type.
  - trash icon (`rowcard-action delete`) deletes the section card; on save, remove the corresponding `opportunity_sections` row.
  - no duplicate action; section cards only support delete and drag reorder.
  - settings/configure drawer contains type-specific fields.
  - drawers are closed by default (zero height) until the `Settings` / `Configure` toggle is clicked; clicking the toggle opens/closes the drawer.

### Rich Text Section

- Section type: `Rich Text`.
- Card label: `Rich Text`.
- Drawer toggle label: `Settings`.
- Follows the same section-card design as other content types.
- Section fields:
  - `Title` input for the section title/label.
  - large rich text field for the section body.
- Rich text editor:
  - use Tiptap when wiring the real editor.
  - constrained toolbar only, per project rules.
- Data shape:
  - `title: string`
  - `body: Tiptap JSON document`

### Links Section

- Section type: `Links`.
- Card label: `Links`.
- Drawer toggle label: `Settings`.
- Section-level fields:
  - `Title (Optional)` is the section title/label shown for this Links section.
  - `Short Description (Optional)` is the section intro/description shown under the Links section title.
- Repeating link rows:
  - each `rowcard withdrag` is one link item.
  - admins can add as many link items as needed with `Add New Link`.
  - each row has a drag handle for reordering links within the section; the array order controls render order.
  - thumbnail/upload picker is a per-link image upload, stored on that link item.
  - `Title` input.
  - `Content link` URL input.
  - delete action removes that link row.
- `Add New Link` appends another link row.
- Data shape:
  - `title?: string`
  - `description?: string`
  - `links: { id: string; title: string; url: string; thumbnailStorageKey?: string }[]`
- LP-facing render:
  - each link renders as `pagecard articlecard w-inline-block`.
  - show the uploaded thumbnail image.
  - show the link title.
  - show the main/root domain derived from the URL, e.g. `https://sequoiacap.com/`.
  - clicking the card navigates to the full provided link URL.

### Documents Section

- Section type: `Documents`.
- Card label: `Documents`.
- Drawer toggle label: `Configure`.
- Section-level fields:
  - `Title (Optional)` is the section title/label shown for this Documents section.
  - `Short Description (Optional)` is the section intro/description shown under the Documents section title.
- Repeating document rows:
  - each `rowcard withdrag` is one document item.
  - admins can add as many document items as needed with `Add New Document`.
  - each row has a drag handle for reordering documents within the section; the array order controls render order.
  - upload icon/picker is the clickable per-document file upload control, stored on that document item.
  - `Document Title` input is the display title for the document.
  - delete action removes that document row.
  - no duplicate action.
- Data shape:
  - `title?: string`
  - `description?: string`
  - `documents: { id: string; title: string; storageKey?: string; fileType?: 'pdf' | 'doc' | 'other'; updatedAt?: string }[]`
- LP-facing render:
  - each document renders as `pagecard documents`.
  - show an icon based on uploaded file type (`PDF`, `DOC`, fallback icon).
  - show document title.
  - show `Last Updated: <date>` based on upload/update timestamp.
  - clicking the card opens an in-browser document preview, not a direct download.
  - preview UI: side drawer that slides out and closes when clicking outside/backdrop.
  - security goal: use short-lived signed URLs or a route-handler proxy suitable for preview; avoid exposing public buckets or direct download UX.

### Team Section

- Section type: `Team`.
- Card label: `Team`.
- Drawer toggle label: `Settings`.
- Section-level fields:
  - `Title (Optional)` is the section title/label shown for this Team section.
  - `Short Description (Optional)` is the section intro/description shown under the Team section title.
- Repeating team member rows:
  - each outer `rowcard withdrag` is one team member.
  - admins can add as many team members as needed with `Add New Team Member`.
  - each member has a drag handle for reordering team members within the section.
  - member image upload picker.
  - `Name` input.
  - `Title` input.
  - delete action removes that team member.
  - no duplicate action.
- Nested social link rows per team member:
  - default rows shown for website, LinkedIn, and X/Twitter.
  - each row has a drag handle, platform icon, and URL input.
  - social row order controls icon/display order.
- Nested callout rows per team member:
  - callouts are short credential/highlight text snippets, e.g. `PHD, Stanford`.
  - `Add New Callout` appends another callout for that member.
- Data shape:
  - `title?: string`
  - `description?: string`
  - `members: { id: string; name: string; title: string; photoStorageKey?: string; socials: { id: string; platform: 'website' | 'linkedin' | 'x' | 'other'; url: string }[]; callouts: { id: string; text: string }[] }[]`

### Investors Section

- Section type: `Investors`.
- Card label: `Investors`.
- Drawer toggle label: `Settings`.
- Structure is intentionally very similar to `Team`.
- Section-level fields:
  - `Title (Optional)` is the section title/label shown for this Investors section.
  - `Short Description (Optional)` is the section intro/description shown under the Investors section title.
- Repeating investor rows:
  - each outer `rowcard withdrag` is one investor/backer.
  - admins can add as many investors as needed with `Add New Investor`.
  - each investor has a drag handle for reordering investors within the section.
  - investor logo/photo upload picker.
  - `Name` input.
  - `Title` input (e.g. investor type/role).
  - delete action removes that investor.
  - no duplicate action.
- Nested social link rows per investor:
  - default rows shown for website, LinkedIn, and X/Twitter.
  - each row has a drag handle, platform icon, and URL input.
  - social row order controls icon/display order.
- Nested callout rows per investor:
  - callouts are short highlight text snippets.
  - `Add New Callout` appends another callout for that investor.
- Data shape:
  - `title?: string`
  - `description?: string`
  - `investors: { id: string; name: string; title: string; logoStorageKey?: string; socials: { id: string; platform: 'website' | 'linkedin' | 'x' | 'other'; url: string }[]; callouts: { id: string; text: string }[] }[]`

## Opportunity Settings

- Checkbox rows use the Webflow `checkboxrow` design and should become a reusable component for future checkbox fields.
- `Require NDA`
  - Backend: existing `opportunities.ndaRequired`.
  - Integration can come later; preserve the static control now.
- `Watermark`
  - Backend: add `opportunities.watermarkEnabled` boolean, default true.
  - When enabled, LP-facing opportunity pages show a tiled, low-opacity dynamic watermark using the LP email address (and timestamp if needed for attribution).
- `Password protected`
  - Backend: add `opportunities.passwordProtected` boolean, default false, plus a secure password storage field (hashed, never plaintext).
  - UI: when checked, reveal the `formfields-block spacetop` password field. When unchecked, hide it and do not require a password.
  - Behavior: when enabled, admins can share the opportunity with someone who is not logged in as an LP. If an unauthenticated visitor opens the opportunity URL, show a password prompt first; a correct password allows viewing that opportunity without an LP session.
  - Security/regulatory note: this is an exception to normal LP access (`opportunity_access` / approved LP login). Implement deliberately with audit logging, rate limiting, and a narrow per-opportunity session/cookie. Do not grant broader app access.
