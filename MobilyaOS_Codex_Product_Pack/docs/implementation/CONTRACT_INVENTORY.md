# Contract Inventory

Status: Initial G1 contract inventory for P2
Run ID: `20260715T040315+0300`

## REST Contracts

P2 must create executable OpenAPI contracts under `api/openapi/**` for:

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET/POST /api/v1/customers`
- `GET/POST /api/v1/suppliers`
- `GET/POST /api/v1/catalog/materials`
- `GET/POST /api/v1/catalog/hardware`
- `GET/POST /api/v1/catalog/edge-bands`
- `GET/POST /api/v1/catalog/labor-operations`
- `GET/POST /api/v1/price-observations`
- `POST /api/v1/price-imports`
- `GET/POST /api/v1/projects`
- `GET/POST /api/v1/projects/{project_id}/revisions`
- `GET/POST /api/v1/product-templates`
- `POST /api/v1/product-variants`
- `POST /api/v1/revisions/{revision_id}/calculate`
- `POST /api/v1/revisions/{revision_id}/nesting`
- `GET /api/v1/revisions/{revision_id}/cost-snapshot`
- `POST /api/v1/revisions/{revision_id}/quote-document`
- `POST /api/v1/revisions/{revision_id}/approve`
- `POST /api/v1/revisions/{revision_id}/send`
- `GET /api/v1/revisions/{left_id}/diff/{right_id}`
- `POST /api/v1/agent/runs`
- `GET /api/v1/agent/runs/{run_id}`
- `GET /api/v1/audit`

Required conventions:

- Prefix `/api/v1`.
- Mutating commands require idempotency key and expected version when revision races matter.
- Errors include `type`, `title`, `status`, `code`, `detail`, `trace_id`, and field violations.
- Tenant/company scope is derived from authenticated context.
- Money is integer minor units plus ISO currency.
- Dimensions are integer millimetres.

## Event Contracts

P2 must create AsyncAPI and CloudEvents examples for:

- `supplier.price.observed.v1`
- `supplier.price.imported.v1`
- `project.created.v1`
- `revision.created.v1`
- `product.variant.generated.v1`
- `bom.generated.v1`
- `nesting.completed.v1`
- `cost.snapshot.created.v1`
- `quote.document.generated.v1`
- `quote.approved.v1`
- `quote.sent.v1`
- `revision.diff.generated.v1`
- `production.package.released.v1`

Envelope fields:

- `specversion`
- `id`
- `source`
- `type`
- `subject`
- `time`
- `datacontenttype`
- `correlationid`
- `causationid`
- `companyid`
- `actorid`
- `data`

## Domain Schemas

P2 must define request/response and persistence-facing contract shapes for:

- Company, user, role, session.
- Customer, supplier, material SKU, hardware SKU, edge-band SKU, labor operation.
- Price observation with append-only provenance.
- Project, quote revision, quote item.
- Product template version and product variant.
- Part, part edge, hardware requirement, operation requirement.
- BOM snapshot.
- Nesting job, sheet, placement, reusable offcut.
- Cost snapshot, cost line, pricing snapshot.
- Approval, generated document, change report.
- Outbox event, inbox consumption, workflow instance.
- Tool invocation, agent run, audit entry.

## Tool and Prompt Contracts

Existing assets:

- `tools/tool_catalog.json`
- `tools/schemas/agent_response.schema.json`
- `tools/schemas/approval_request.schema.json`
- `tools/schemas/revision_diff.schema.json`
- `tools/schemas/tool_error.schema.json`
- `prompts/registry.yaml`

P2 requirements:

- Validate all prompt registry paths and required variables.
- Validate tool inputs against strict per-action schemas or a narrowed runtime validator.
- Validate model output against `agent_response.schema.json`.
- Reject or repair invalid structured output before any action proposal is trusted.
- Tool gateway enforces delegated user, tenant, role, approval, idempotency, and revision/version checks.

## Golden Fixture Contracts

P2 must expand `evals/seed_data_spec.yaml` into deterministic fixtures for:

- Demo company and users.
- Suppliers and price observations.
- Materials, hardware, edge bands, labor operations, tax and pricing policies.
- Wardrobe quote with quantity greater than one.
- Kitchen base-cabinet quote.
- Approved revision and forked draft revision with meaningful diff.

Expected outputs must include BOM, edge lengths, hardware, operations, nesting placements, cost categories, pricing steps, PDF metadata, and revision diff categories.

## Contract Freeze Rules for P2

- Parent owns shared contract files.
- Backend may edit `api/openapi/**` and `api/asyncapi/**` only under parent lease.
- Frontend and AI cannot invent fields not present in frozen contracts.
- Breaking changes use the contract-change handoff protocol.
