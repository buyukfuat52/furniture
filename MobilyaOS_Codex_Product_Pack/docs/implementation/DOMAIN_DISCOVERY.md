# Domain Discovery

Status: Initial P1 domain discovery
Run ID: `20260715T040315+0300`

## Bounded Contexts

- Identity and access.
- Companies and users.
- Catalog and supplier pricing.
- Customers and projects.
- Product templates and variants.
- Design, BOM, part edges, hardware, and operations.
- Nesting and offcuts.
- Costing and pricing.
- Quotes, generated documents, approvals.
- Revisions and semantic diff.
- Workflow, outbox/inbox, and audit.
- Agent runs, tools, and prompt registry.

## Core Aggregates

- Company.
- User, role, session, refresh token.
- Supplier and price observation.
- Material, hardware, edge-band, and labor SKUs.
- Customer and project.
- QuoteRevision and QuoteItem.
- ProductTemplateVersion and ProductVariant.
- BOMSnapshot.
- NestingJob, NestingSheet, NestingPlacement, Offcut.
- CostSnapshot and PricingSnapshot.
- Approval and GeneratedDocument.
- ChangeReport.
- OutboxEvent and InboxConsumption.
- ToolInvocation and AgentRun.
- AuditEntry.

## Transaction Boundaries

- Auth/session commands: user, session, token audit.
- Catalog/price observation commands: append observations and audit.
- Project/revision mutation: quote revision expected version, item/config changes, audit, outbox.
- Calculation snapshot creation: deterministic result, provenance, formula version, command idempotency, outbox event.
- Nesting/PDF workflows: job state transition, artifact metadata, hash/object key, outbox.
- Approval/send: policy check, approval token validation, revision state guard, audit, outbox.
- Fork/diff: parent revision linkage, immutable source snapshot, diff record, audit.
- Agent tool call: delegated identity, roles, company, input schema, idempotency, approval state, audit.

## Contract Inventory for P2

- REST endpoints under `/api/v1` for auth, catalog, price observations/imports, projects, revisions, calculations, nesting, costs, quote documents, approval/send, diff, agent runs, and audit.
- CloudEvents-compatible envelope and event catalog for price, project, revision, BOM, nesting, cost, quote, approval, sent, diff, and production events.
- Tool schemas and authorization matrix for project, catalog, design, manufacturing, costing, document, supplier, and workflow tools.
- Prompt registry and structured agent response schema.
- Database migrations for tenant-owned entities, immutable guards, idempotency, outbox/inbox, audit, and artifact metadata.
- Golden fixture schemas for wardrobe and kitchen base cabinet.

## Open Decisions

- ID type: UUID or ULID.
- Template formula representation and validation/publishing workflow.
- Workflow adapter: Temporal or durable local adapter first.
- Exact rounding policy and percentage representation in API.
- Detailed price unit conversion schema.
