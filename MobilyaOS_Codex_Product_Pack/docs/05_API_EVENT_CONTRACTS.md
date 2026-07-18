# API and Event Contracts

## REST conventions
- Prefix `/api/v1`.
- OpenAPI is generated or validated in CI.
- Use request IDs and idempotency keys for commands.
- Pagination uses stable cursor where possible.
- Errors use `type`, `title`, `status`, `code`, `detail`, `trace_id`, and field violations.
- Mutating requests validate expected version for optimistic concurrency.

## Representative endpoints
- `/auth/login`, `/auth/refresh`, `/auth/logout`
- `/customers`, `/suppliers`
- `/catalog/materials`, `/catalog/hardware`, `/catalog/edge-bands`, `/catalog/labor-operations`
- `/price-observations`, `/price-imports`
- `/projects`, `/projects/{id}/revisions`
- `/product-templates`, `/product-variants`
- `/revisions/{id}/calculate`
- `/revisions/{id}/nesting`
- `/revisions/{id}/cost-snapshot`
- `/revisions/{id}/quote-document`
- `/revisions/{id}/approve`, `/revisions/{id}/send`
- `/revisions/{left}/diff/{right}`
- `/agent/runs`, `/agent/runs/{id}`
- `/audit`

## Event envelope
Required fields:
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

## Initial event catalog
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

Document payload schemas in AsyncAPI and validate examples in CI.
