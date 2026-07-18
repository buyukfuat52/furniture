# Domain Invariants

MobilyaOS is in a Supabase-backed post-P5.5 demo/session phase. The application may still keep selected demo behaviors lightweight, but the domain boundary must already assume that tenant, session, role, quote, costing, and approval decisions are server-side responsibilities.

## Tenant, Session, User, and Role Invariants

- Every persisted business record belongs to exactly one tenant.
- Tenant identity is derived from authenticated session context and backend policy, never from editable browser state.
- A user may act only within tenants that the backend has associated with that user.
- A session represents an authenticated browser interaction for one user and must not grant authority beyond that user's current tenant memberships and roles.
- Role checks are enforced by backend/domain code and database policies before a mutation is accepted.
- Browser-side role flags, cached profiles, route guards, and hidden controls are usability aids only. They do not authorize reads, writes, exports, sends, approvals, or production actions.
- Cross-tenant reads, writes, joins, imports, exports, and generated artifacts are invalid even when identifiers are known.
- Demo or seed users may exist for the sprint, but they must still resolve through the same tenant/session/role shape used by Supabase-backed flows.

## Browser Non-Authority

The browser must never be authoritative for:

- Tenant id, user id, role, membership, or permission grants.
- Project ownership, quote ownership, or customer ownership.
- Quote status, approval state, send eligibility, PDF eligibility, or production package eligibility.
- BOM, cost, tax, margin, edge banding, labor, discount, currency, and quote totals.
- Whether a domain transition is allowed.
- Whether a generated document, export, or production artifact is valid.
- Any audit timestamp, approver identity, sender identity, or mutation provenance.

Client code may collect user intent, render previews, cache drafts, and submit commands. The backend/domain layer decides whether the command is valid and computes authoritative state.

## Current Customer, Project, and Quote Mutation Scope

Allowed during the current Supabase-backed build-train checkpoint:

- Establish authenticated tenant context through a durable local-demo session.
- Read seeded Supabase demo company, customer, project, quote, BOM, cost, document, approval, revision, and audit data through server-side tenant scope.
- Accept the first Supabase-backed mutation commands only for creating customers, creating projects, creating quote drafts, creating/updating quote configuration drafts, calculating the narrow wardrobe snapshot, generating frozen HTML quote documents, forking quote revisions, preparing admin-only approval gates, consuming approval tokens through the guarded approval-finalization RPC, and appending audit entries.
- Accept the first deterministic persisted calculation command only for the saved wardrobe configuration draft on a tenant-scoped draft quote revision.
- Read and list quote revisions through tenant-scoped backend routes.
- Read current project/revision/configuration/snapshot context through the read-only web agent chat route.
- Verify tenant isolation with a second seeded tenant fixture and true cross-tenant IDOR probes.
- Keep authenticated Supabase public-key access read-only for app data; mutations must use server routes or future audited RPCs.
- Keep browser-collected project or quote intent as non-authoritative until accepted by backend/domain validation.
- Preserve deterministic recalculation requirements for any future accepted mutation.

Deferred beyond this sprint:

- Sending quotes to customers.
- Treating generated PDFs as legally or commercially final.
- Creating production packages from quotes.
- Quote rejection workflows, approver assignment workflows, customer send ledgers, and delivery workflows.
- Direct or browser-driven quote status transitions beyond draft.
- Marking quote drafts as sent, PDF-ready, production-ready, or commercially final.
- Payment, tax filing, accounting, procurement, inventory reservation, manufacturing release, and delivery commitments.
- Bulk import/export and cross-tenant administrative mutation flows.

Prepared mutation support must not imply that a quote is sendable, approved, priced for production, or ready for downstream operations.

## First Supabase Mutation Route Invariants

The first mutation routes are command endpoints, not direct table-write affordances. Each command accepts browser intent, resolves trusted context on the server, validates tenant and role authorization, performs the narrow persistence action, and records audit provenance where applicable.

Route-specific invariants:

- Create customer: creates a tenant-owned customer record only within the company resolved from the trusted server session. Browser-supplied company, tenant, owner, creator, role, or audit actor fields are ignored or rejected.
- Create project: creates a tenant-owned project only for a customer visible within the same resolved company. Cross-company customer/project links are invalid even if the identifiers exist.
- Create quote draft: creates only a draft quote record for a same-company project and customer. The persisted status must be `draft`; the command must not imply that totals are calculated, approval has started, approval has completed, the quote has been sent, a final PDF exists, or production may begin.
- Create/update quote configuration draft: persists only validated draft input for a draft quote revision. Dimensions are integer millimetres, quantity is explicit pieces, option counts are bounded integers, and persisted calculation status is fixed to `not_calculated`. The command must not create or imply authoritative BOM, edge banding, labor, cost, tax, margin, quote total, PDF, approval, send, or production package state.
- Calculate quote snapshot: reads only the persisted configuration draft for a tenant-scoped draft quote revision, validates the deterministic wardrobe slice, and persists frozen BOM/cost snapshots with formula version, integer money, integer millimetre quantities, edge-band rows, labor rows, quote total fields, and provenance. The command must reject browser-supplied tenant, actor, role, status, BOM, cost, total, snapshot, approval, PDF, send, or production fields.
- Read quote snapshot: returns `calculated` only when the persisted cost provenance matches the current configuration draft id/version, quote revision id, and BOM snapshot hash. If the configuration draft changes after calculation, prior snapshots are frozen history but not current calculation state.
- Generate frozen quote document: reads only the current persisted calculated snapshot and tenant-scoped draft revision, then stores deterministic HTML with revision version, cost snapshot ID, calculation version, snapshot hash, document version, and SHA-256. The command must reject browser-supplied totals, document hashes, storage locators, status, approval, send, PDF, or production fields.
- Read frozen quote artifact: document JSON returns metadata only. Raw HTML is served only through the authenticated tenant-scoped preview route and must not expose storage locators, raw approval tokens, token hashes, or customer-send authority.
- Fork quote revision: creates a draft child revision with `parent_revision_id` and copies configuration input only. Frozen snapshots, generated documents, approval gates, sent state, approval state, and production state are not copied.
- Read revision diff: computes a deterministic server-derived same-project diff from tenant-scoped revision/configuration/snapshot/document facts before any LLM explanation.
- Prepare approval gate: `admin` only. Creates a pending approval gate bound to revision version, frozen document, document hash, cost snapshot, snapshot hash, expiry, and approval token version. It stores only token hash material and never returns a raw token or token hash.
- Consume approval token: accepts only a strict token body, hashes it server-side, validates token hash, expiry, replay state, company, quote revision id/version, current configuration provenance, cost snapshot id/hash, frozen document id/hash, and draft quote status. A valid pending token may transition the bound draft quote revision to `approved` inside the service-role RPC and append audit rows. Invalid, expired, replayed, stale, mismatched, or non-draft tokens must not change quote status. The response must not send a quote, expose tenant/document/revision identifiers, expose token material, or create a production package.
- Read send gate: returns only sanitized, tenant-scoped readiness/deferred-action metadata for the authenticated session. P9 send-gate status must not send email, expose delivery secrets, mark PDF final, or create production state.
- Read/list quote revisions: returns only revisions visible to the resolved company and user role. Revision reads are non-mutating and must not recalculate, approve, send, finalize, or promote a quote.
- Append audit: records audit entries using trusted server-derived company, app user, session, timestamp, route/action, and request provenance. Browser-provided actor, company, tenant, user, role, timestamp, and session identifiers are never authoritative.

Role invariants for these routes:

- `viewer` is read-only. A viewer may read tenant-authorized data and quote revisions, but must not create customers, projects, quote drafts, configuration drafts, snapshots, documents, forks, audit entries through user commands, sends, approvals, PDFs, or production packages.
- `sales` may create customers, projects, quote drafts, create/update quote configuration drafts, run the deterministic snapshot calculation, generate frozen HTML quote documents, and fork revisions for the resolved company when route-specific validation passes.
- `admin` may do the same writer actions as `sales` and may prepare approval gates.
- Risky quote actions remain deferred for all roles unless an explicit domain gate exists. P9 allows only approval-token-consumption-driven draft-to-approved finalization through the service-role RPC. Quote send, final binary PDF generation, production package creation, and downstream operational release remain deferred.

Idempotency expectations:

- Mutation idempotency is scoped by resolved company, app user or trusted session, route/action, and caller-provided idempotency key.
- Replaying the same scoped idempotency key must not create duplicate customer, project, quote draft, quote configuration draft, or audit side effects.
- Reusing the same key for a different route/action, company, user/session, or materially different payload is invalid or treated as a separate scope according to backend policy.
- Current Supabase-backed draft mutations, including configuration draft create/update, use durable idempotency records scoped by company, app user, action, and hashed key.
- Mutation routes require an idempotency key; missing keys are rejected before writes.
- Raw idempotency keys are not stored. Replay stores only sanitized response JSON and status code.
- Idempotency storage must not trust browser actor or company fields; it uses the same server-resolved context as authorization and audit.

## Deterministic Domain Responsibilities

BOM, cost, tax, margin, edge banding, labor, quote totals, frozen documents, revision fork/diff, approval-gate preparation, approval-token finalization, and send-gate status remain deterministic backend/domain responsibilities. P6/P7/P8/P9 implement one narrow wardrobe persisted quote lifecycle; everything outside that slice remains deferred to future deterministic backend/domain services.

LLM output and frontend calculations may be used only as suggestions, previews, or input collection aids. They must not become the source of truth for:

- Line item normalization.
- Material quantities.
- Edge banding requirements.
- Labor estimates.
- Cost basis.
- Tax rules.
- Margin application.
- Discount application.
- Quote total computation.
- Approval or send readiness.

Any accepted quote mutation that changes commercial meaning must be followed by backend/domain recalculation before persisted totals or status-dependent actions are considered valid. Snapshot reads must verify provenance against the current draft/version instead of trusting the latest row by revision id alone.

## Approval Gates and Status Transitions

Future quote send, binary PDF, and production package work must pass explicit approval gates. P7 prepares a pending approval gate; P8 introduced safe token consumption; P9 permits a valid bound pending token to finalize a draft quote revision as approved. Quote drafts remain non-sendable, non-PDF-final, and non-production-ready.

Required constraints for future status transitions:

- Current Supabase quote draft routes may create only `draft` revisions.
- Current quote detail responses may describe status policy, but they do not activate direct status updates.
- Direct browser writes of `approved`, `sent`, `accepted`, `rejected`, or any other quote status are invalid. There is no PATCH/POST status route in the current Supabase surface.
- Status changes are commands validated by the backend/domain layer, not direct browser writes.
- In P9, a quote can move from draft to approved only through the service-role approval-token consumption RPC after all token, revision-version, snapshot, document, and current-provenance bindings match.
- A quote can move from approved to sent only after deterministic totals are current and the backend confirms send eligibility.
- A PDF can be marked final only when generated from the approved quote snapshot and linked to that immutable quote version.
- A production package can be created only from an approved or otherwise explicitly production-authorized quote snapshot.
- Rejection, cancellation, expiry, or revision must prevent stale send/PDF/production actions from using superseded totals or artifacts.
- Every approval, send, final PDF, and production package transition must record backend-derived tenant, timestamp, source quote version, resulting status, and the safest available actor/customer provenance without exposing token material.

Direct status edits, client-only approval flags, and artifact generation without a validated quote snapshot are invalid.

## Supabase-Backed Scope and Remaining Mock Scope

Current Supabase-backed scope:

- Authenticated session context.
- Tenant-scoped seeded demo reads for customers, projects, quotes, snapshots, documents, approvals, quote revisions, and audit entries.
- First tenant-scoped create routes for customers, projects, and quote drafts.
- Tenant-scoped create/update routes for quote configuration draft input with `not_calculated` status.
- Tenant-scoped deterministic wardrobe BOM/cost snapshot calculation and current snapshot reads.
- Tenant-scoped guarded approval-token finalization from draft to approved when the current revision/document/snapshot bindings match.
- Tenant-scoped read-only send-gate status that keeps email delivery, binary PDF generation, and production-package creation deferred.
- Backend-owned audit append for accepted route actions.
- Backend/database policy enforcement for tenant-scoped reads, authenticated direct-write denial, and first scoped mutations wired into the current demo flow.
- A local-demo browser session intended to survive reloads until expiry or logout.
- Second tenant fixture rows used for live tenant isolation checks.

Remaining in-memory or mock scope:

- Any flow not yet wired to Supabase persistence.
- Quote send, official binary PDF, production package, and downstream operational mutations in the current web flow.
- Any customer, project, quote, revision, or audit behavior outside the first scoped routes defined above.
- Placeholder catalogs, pricing tables, quote send records, PDF outputs, production package records, and downstream operational integrations.
- Client previews that help users understand pending changes before backend/domain acceptance.
- Demo-only fixtures used for product exploration and sprint validation.

Mock data may support the demo experience, but it must be labeled and handled as non-authoritative. When a domain concern has both mock and Supabase-backed representations, the Supabase-backed backend/domain result wins.
