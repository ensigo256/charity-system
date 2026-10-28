# Sponsor–Child Many-to-Many Implementation Plan

## Objective

Allow each child to have multiple concurrent sponsors and each sponsor to support multiple children, while keeping sponsorship-specific amounts, payments, dates, and lifecycle on the relationship. Keep every publicly listed child visible on the website after sponsorship begins, and show child photos without cropping or distortion across all image ratios.

This plan covers three repositories:

- Public website: `C:\Users\hawa\charity`
- Admin system: `C:\Users\hawa\charity-system`
- Backend/API: `C:\Users\hawa\charity-server`

## Target architecture

Use one `Sponsorships` record for each sponsor–child commitment. This is the relationship entity and source of truth:

```text
Sponsorship
  child
  donor (sponsor)
  status
  amount / currency / frequency
  startDate / endDate
  payments and pledge references
```

Do not maintain mirrored sponsor-ID and child-ID arrays as authoritative links. Stop relying on the singular `ChildProfile.sponsor` and `Sponsor.child` fields; remove them after migration and callers are switched, or retain them temporarily only as explicitly deprecated compatibility fields.

Keep three concepts separate:

1. **Public listing eligibility**: whether the child profile is approved/published and may appear publicly.
2. **Funding state**: derived from active and, according to policy, pending sponsorship records (for example, Available, Partially funded, Fully funded).
3. **Sponsorship lifecycle**: the status of an individual sponsor–child commitment.

A child’s funding state must never determine whether an otherwise published profile remains listed.

## Decisions required before implementation

Record and approve these rules before changing write paths:

- Can the same sponsor have more than one open sponsorship for the same child? Recommended default: one open record per pair, with a new record allowed after the prior one closes.
- Do Pending pledges reserve support capacity, or only confirmed/Active sponsorships?
- Is each contribution a one-time amount, a recurring commitment, or both? How are its period and currency represented for aggregate funding comparisons?
- Can total commitments exceed the child’s need? If capped, what is the exact cap and how are concurrency and overpayment handled?
- What profile field or approval workflow controls public listing? Do not reuse `publicPosterApproved` unless the organization explicitly intends poster approval to control website publication.
- What should the pledge CTA do for a Fully funded child who remains publicly listed? Recommended: keep the profile visible and explain that no further pledge is currently accepted, with an alternate way to support other children.

Do not compare or sum commitments across currencies or incompatible periods without an explicit conversion/normalization rule.

## Phase 1 — Audit and data model

1. Inventory all reads and writes of `ChildProfile.sponsor`, `Sponsor.child`, and `sponsorshipStatus` in the backend, admin system, and public website.
2. Compare existing sponsor/child references with `Sponsorships` records. Identify missing relationships, duplicate open records, inconsistent donors/children, and payment history that would be affected by any repair.
3. Confirm that `Sponsorships` has the complete relationship data required by every workflow. Keep payment records attached to the relevant sponsorship. Consider a separate payments collection only if measured record growth or query needs justify it.
4. Add or confirm indexes for the primary queries: `{ child, status, createdAt }` and `{ donor, status, createdAt }`. If the approved rule is one open record per pair, add an appropriate partial unique index on `{ child, donor }` after auditing and resolving existing duplicates.
5. Normalize lifecycle statuses across schema and handlers before adding constraints; all statuses written by controllers must be accepted by the model.
6. Design a repeatable migration/backfill with a dry-run report, backups, idempotency, and a reconciliation log. Preserve historical sponsorships and payment attribution; do not infer missing records silently.

**Exit criteria:** data discrepancies are documented and reconciled; supported status and duplicate-pair rules are agreed; migration can be safely re-run without duplicating records.

## Phase 2 — Backend as the source of truth

1. Implement shared sponsorship operations for create, activate, cancel/close, and status changes. Every path—admin assignment, public pledge, ACH/Stripe confirmation, archival, and unlink—must act on a specific sponsorship record.
2. Replace `upsertSponsorSponsorship` behavior that finds the latest record for a child and changes its donor. Creating another sponsor relationship must create a separate record, subject to the pair-uniqueness rule.
3. Remove child-wide “must be Available” restrictions where they prevent a second valid sponsor. Validate the selected child and funding rules against the relationship records instead.
4. Make aggregate funding reservations atomic if a funding cap applies. A check-then-insert outside a transaction or equivalent concurrency-safe mechanism can let simultaneous pledges exceed the cap.
5. Derive funding summaries from the defined eligible statuses and amounts. If summaries are cached on child profiles for performance, update them transactionally and provide a rebuild-from-sponsorships process; the cache must not become the source of truth.
6. Make cancellation, unlinking, sponsor archiving, and sponsor profile edits relationship-aware. Closing one sponsorship must leave other sponsors and sponsorships for that child intact.
7. Add/adjust endpoints for:
   - a child’s active sponsors and sponsorship history;
   - a sponsor’s children and relationship summaries;
   - public child listings and public details with a safe funding summary.
   Paginate relationship/history responses and select only fields required by each view. Never expose private sponsor contact details publicly.
8. Keep dashboard/reporting counts distinct: number of children, number of sponsorships, committed amount, paid amount, and remaining need.
9. After all callers migrate, stop populating or writing the singular relationship fields and remove them in a later, separately verified migration.

**Key backend files to update:** `models/childProfile.js`, `models/sponsor.js`, `models/sponsorships.js`, `controllers/sponsorControllers.js`, `controllers/childProfileControllers.js`, `controllers/dashboardControllers.js`, payment-attempt and reminder flows, and their routes/tests.

**Exit criteria:** multiple sponsors can be active for one child; one sponsor can support multiple children; lifecycle and payment operations affect only the targeted relationship; public profiles return safe derived summaries.

## Phase 3 — Admin system

1. Replace child detail/list reliance on one `child.sponsor` with sponsorship data from relationship endpoints.
2. Show multiple current sponsors per child, with each relationship’s amount, period, status, start date, and actions.
3. Allow staff to add a sponsor to an already-sponsored child when funding rules allow it. Display validation errors from the server when capacity or policy disallows the new relationship.
4. Make unlink/cancel target a selected sponsorship, not every active/pending sponsorship attached to the child.
5. Update sponsor details to show all linked children and relationship-level amounts/statuses; retain the existing sponsorship-record-based behavior where correct.
6. Replace manually edited binary child sponsorship status with a derived funding summary. Ensure child profile edits cannot overwrite relationship state.
7. Update exports, dashboard cards, filters, and charts to distinguish children from sponsorship records and to display funding totals consistently.

**Key system files to review:** `app/(dashboard)/dashboard/children/page.tsx`, `app/(dashboard)/dashboard/children/[id]/page.tsx`, `app/(dashboard)/dashboard/sponsorships/page.tsx`, `app/(dashboard)/dashboard/sponsorships/[id]/page.tsx`, and `lib/types.ts`.

**Exit criteria:** staff can inspect and manage multiple sponsorship relationships without one relationship hiding or overwriting another.

## Phase 4 — Public website and persistent listing

1. Change public list and detail queries to filter by the approved **public listing** rule, not by whether the child has a sponsor. The current backend public list and detail queries filter on `sponsorshipStatus: "Available"`; replace that coupling. Keep unpublished/private profiles excluded.
2. Return and display safe funding fields such as support status, need, eligible committed amount, and remaining amount, using the agreed currency/period rules. Do not return sponsor identities or private data.
3. Keep every published profile discoverable—including Partially funded and Fully funded children—unless the organization explicitly unpublishes it. Update headings and counts: “Children available” must not imply that already-sponsored profiles disappeared from the listing.
4. Keep each pledge submission tied to one child and create one relationship record per pledge. The existing one-child `childId` form is suitable for this. A multi-child checkout/basket is optional future scope; if introduced, submit separate child allocations and create separate sponsorship records.
5. Handle stale funding summaries: the backend revalidates the pledge at submission; if no additional support can be accepted, show a clear explanation and refresh the profile summary rather than silently failing.
6. Decide how repeat public donors are recognized. Do not merge sponsor records solely because submitted email strings match; use verified identity/account rules if linking a person’s separate pledges is required.

**Key website files to review:** `app/(public)/donate/page.tsx`, `app/(public)/donate/[id]/page.tsx`, `components/public/sponsorship-card.tsx`, `components/public/sponsor-details-content.tsx`, `components/public/sponsor-details/hero-section.tsx`, `components/public/sponsorship-form-modal.tsx`, and `lib/child-profile.ts`.

**Exit criteria:** a published child remains in both the browse list and public detail route after any number of sponsorships; only the ability to accept another pledge changes with funding policy.

## Phase 5 — Child image presentation

The public child card and hero currently use `object-fit`, which is not the Tailwind utility for image fitting and does not provide the requested behavior. Update both image containers to preserve a consistent layout while showing the entire image:

- **Browse cards:** use a stable responsive aspect-ratio frame with a neutral/background color and `object-contain`, centered. Constrain image width/height to the frame; do not stretch, crop, or zoom on hover in a way that clips the image.
- **Detail hero:** use a responsive frame with a sensible maximum height and `object-contain`, centered against a matching backdrop. Allow portrait, landscape, square, and unusually wide/tall source images to remain fully visible without distorting the rest of the hero layout.
- Provide useful alt text, preserve rounded corners, and verify small/mobile as well as large layouts.
- Prefer a shared image-frame component only if it reduces duplicated styling without obscuring the distinct card and hero sizing needs.

**Visual acceptance:** portrait, landscape, square, and panoramic test images all show their full content, preserve intrinsic proportions, do not overflow their frames, and leave no broken layout at mobile/tablet/desktop breakpoints.

## Phase 6 — Migration and rollout

1. Back up production data and run the relationship audit in report-only mode.
2. Reconcile data and run the idempotent backfill in a staging environment.
3. Deploy backend changes that support the new relationship model and public-listing semantics.
4. Deploy the admin system and public website against the updated API. Use a short-lived compatibility response only where needed for staggered deployment; do not allow old singular fields to overwrite new relationships.
5. Monitor pledge conflicts, duplicate/open pair errors, list/detail 404 rates, payment attribution, and aggregate funding totals.
6. Remove deprecated singular fields and compatibility code only after logs and code search show no active callers.

## Verification checklist

### Backend and data

- Two different sponsors can maintain valid concurrent sponsorships for one child.
- One sponsor can maintain valid sponsorships for multiple children.
- Pair-duplication behavior matches the approved rule.
- Concurrent pledges obey the funding-cap and pending-reservation rules.
- Closing, unlinking, or archiving one relationship leaves other relationships and their payments intact.
- ACH and Stripe pledge/confirmation/retry paths attribute funds to the intended sponsorship.
- Migration is idempotent, preserves historical payments, and reports unresolved conflicts.
- Public endpoints include only approved profiles and never expose sponsor contact information.

### Admin system

- Child and sponsor views display all relevant current relationships and history.
- Relationship-level actions affect only the selected sponsorship.
- Counts and exports distinguish children from sponsorship records and use consistent funding calculations.

### Public website

- Published children remain listed before and after sponsorships, including Fully funded children.
- Public detail routes remain accessible for listed sponsored children.
- Funding labels, remaining amounts, and pledge availability match backend calculations.
- A stale or full-commitment pledge attempt has a clear, recoverable user experience.

### Images

- Card and detail hero fully display portrait, landscape, square, and panoramic images without cropping or stretching.
- Both image frames remain visually consistent and responsive across viewport sizes.

## Recommended implementation order

1. Approve business rules and visibility policy.
2. Audit data and establish migration/index plan.
3. Implement and test backend relationship/lifecycle behavior.
4. Update admin system.
5. Update public API listing semantics and public website.
6. Apply and visually verify image-frame changes.
7. Run migration, deploy, monitor, and remove compatibility fields only after verification.
