# Domain Invariants

MobilyaOS P5.4/P5.5 is in a Supabase-backed demo/session phase. The application may still keep selected demo behaviors lightweight, but the domain boundary must already assume that tenant, session, role, quote, costing, and approval decisions are server-side responsibilities.

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

Allowed during the P5.4/P5.5 Supabase-backed demo/session sprint:

- Establish authenticated tenant context through a durable local-demo session.
- Read seeded Supabase demo company, customer, project, quote, BOM, cost, document, approval, revision, and audit data through server-side tenant scope.
- Accept the first Supabase-backed mutation commands only for creating customers, creating projects, creating quote drafts, and appending audit entries.
- Read and list quote revisions through tenant-scoped backend routes.
- Keep browser-collected project or quote intent as non-authoritative until accepted by backend/domain validation.
- Preserve deterministic recalculation requirements for any future accepted mutation.

Deferred beyond this sprint:

- Sending quotes to customers.
- Treating generated PDFs as legally or commercially final.
- Creating production packages from quotes.
- Quote approval workflows, approver assignment, rejection workflows, and approval audit ledgers.
- Quote status transitions beyond draft.
- Marking quote drafts as calculated, approved, sent, PDF-ready, production-ready, or commercially final.
- Payment, tax filing, accounting, procurement, inventory reservation, manufacturing release, and delivery commitments.
- Bulk import/export and cross-tenant administrative mutation flows.

Prepared mutation support must not imply that a quote is sendable, approved, priced for production, or ready for downstream operations.

## First Supabase Mutation Route Invariants

The first mutation routes are command endpoints, not direct table-write affordances. Each command accepts browser intent, resolves trusted context on the server, validates tenant and role authorization, performs the narrow persistence action, and records audit provenance where applicable.

Route-specific invariants:

- Create customer: creates a tenant-owned customer record only within the company resolved from the trusted server session. Browser-supplied company, tenant, owner, creator, role, or audit actor fields are ignored or rejected.
- Create project: creates a tenant-owned project only for a customer visible within the same resolved company. Cross-company customer/project links are invalid even if the identifiers exist.
- Create quote draft: creates only a draft quote record for a same-company project and customer. The persisted status must be `draft`; the command must not imply that totals are calculated, approval has started, approval has completed, the quote has been sent, a final PDF exists, or production may begin.
- Read/list quote revisions: returns only revisions visible to the resolved company and user role. Revision reads are non-mutating and must not recalculate, approve, send, finalize, or promote a quote.
- Append audit: records audit entries using trusted server-derived company, app user, session, timestamp, route/action, and request provenance. Browser-provided actor, company, tenant, user, role, timestamp, and session identifiers are never authoritative.

Role invariants for these routes:

- `viewer` is read-only. A viewer may read tenant-authorized data and quote revisions, but must not create customers, projects, quote drafts, audit entries through user commands, sends, approvals, PDFs, or production packages.
- `sales` may create customers, projects, and quote drafts for the resolved company when the route-specific validation passes.
- `admin` may create customers, projects, and quote drafts for the resolved company when the route-specific validation passes.
- Risky quote actions remain deferred for all roles until explicit domain gates exist: send, approval, final PDF generation, production package creation, and downstream operational release.

Idempotency expectations:

- Mutation idempotency is scoped by resolved company, app user or trusted session, route/action, and caller-provided idempotency key.
- Replaying the same scoped idempotency key must not create duplicate customer, project, quote draft, or audit side effects.
- Reusing the same key for a different route/action, company, user/session, or materially different payload is invalid or treated as a separate scope according to backend policy.
- The current sprint may implement idempotency with a lightweight local guard or audit-backed lookup until a durable idempotency table exists. This is a known limitation, not permission to accept duplicate writes silently.
- Idempotency storage must not trust browser actor or company fields; it uses the same server-resolved context as authorization and audit.

## Deterministic Domain Responsibilities

BOM, cost, tax, margin, edge banding, labor, and quote totals remain deterministic backend/domain responsibilities.

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

Any accepted quote mutation that changes commercial meaning must be followed by backend/domain recalculation before persisted totals or status-dependent actions are considered valid.

## Approval Gates and Status Transitions

Future quote send, PDF, and production package work must pass explicit approval gates. Until those gates are implemented, quote drafts remain non-sendable and non-production-ready.

Required constraints for future status transitions:

- Status changes are commands validated by the backend/domain layer, not direct browser writes.
- A quote can move from draft to review only when required project, customer, line, pricing, and tenant context is complete.
- A quote can move from review to approved only through an authorized approval action by a role permitted for that tenant.
- A quote can move from approved to sent only after deterministic totals are current and the backend confirms send eligibility.
- A PDF can be marked final only when generated from the approved quote snapshot and linked to that immutable quote version.
- A production package can be created only from an approved or otherwise explicitly production-authorized quote snapshot.
- Rejection, cancellation, expiry, or revision must prevent stale send/PDF/production actions from using superseded totals or artifacts.
- Every approval, send, final PDF, and production package transition must record backend-derived actor, tenant, timestamp, source quote version, and resulting status.

Direct status edits, client-only approval flags, and artifact generation without a validated quote snapshot are invalid.

## Supabase-Backed Scope and Remaining Mock Scope

Current Supabase-backed scope:

- Authenticated session context.
- Tenant-scoped seeded demo reads for customers, projects, quotes, snapshots, documents, approvals, quote revisions, and audit entries.
- First tenant-scoped create routes for customers, projects, and quote drafts.
- Backend-owned audit append for accepted route actions.
- Backend/database policy enforcement for tenant-scoped reads and first scoped mutations wired into the current demo flow.
- A local-demo browser session intended to survive reloads until expiry or logout.

Remaining in-memory or mock scope:

- Any flow not yet wired to Supabase persistence.
- Product, quote fork, quote diff, quote send, quote approval, PDF, production package, and downstream operational mutations in the current web flow.
- Any customer, project, quote, revision, or audit behavior outside the first scoped routes defined above.
- Placeholder catalogs, pricing tables, approval records, PDF outputs, production package records, and downstream operational integrations.
- Client previews that help users understand pending changes before backend/domain acceptance.
- Demo-only fixtures used for product exploration and sprint validation.

Mock data may support the demo experience, but it must be labeled and handled as non-authoritative. When a domain concern has both mock and Supabase-backed representations, the Supabase-backed backend/domain result wins.
