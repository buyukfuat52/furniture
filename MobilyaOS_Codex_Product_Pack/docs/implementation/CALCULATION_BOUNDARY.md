# Calculation Boundary Scaffolding

Status: Phase 3 compute scaffold plus P6 first persisted wardrobe snapshot slice.

## Purpose

The compute service contains typed contracts for future deterministic furniture calculations. These contracts make the boundary explicit before broad BOM, edge, labor, material cost, pricing, and quote-total engines are wired to the long-term backend service.

P6 also adds one narrow authoritative persisted path in the Next.js server/Supabase boundary:

- `POST /api/supabase/quote-revisions/[quoteRevisionId]/calculate`
- `GET /api/supabase/quote-revisions/[quoteRevisionId]/snapshot`

That path calculates only the saved wardrobe/vestiyer configuration draft, persists frozen BOM/cost snapshots, and keeps quote send, approval, official PDF, fork/diff persistence, and production actions gated.

## Invariants

- Dimensions are strict positive integer millimetres.
- Money is strict integer minor units plus ISO currency.
- Quantities use an explicit unit and reject binary floats.
- Margin and markup are distinct modes.
- Target gross margin must be below 100%.
- Every meaningful request/response carries non-empty provenance.
- Formula provenance requires a formula version; price-observation provenance requires an observed timestamp.
- Shape collections are bounded to reduce accidental resource exhaustion in local/dev use.
- LLMs and chat agents are not calculation authorities.
- Persisted snapshots must bind provenance to the current configuration draft id/version and BOM snapshot hash before being reported as current.
- A configuration draft update makes prior snapshots stale until a new deterministic snapshot is persisted.

## Implemented Contracts

- Measurement input.
- Product template reference and product configuration input.
- BOM calculation request/response.
- Edge banding request/response.
- Labor cost request/response.
- Material cost request/response.
- Markup / target gross margin pricing request/response.
- Quote total request/response.

## Preview Adapter

`NonProductionCalculationBoundaryAdapter` validates request shape and returns a stable contract hash.

It always returns:

- `authoritative_calculation: false`
- `adapter_id: non_production_contract_adapter`
- `validated_shapes`, meaning only "schema shape accepted", not "domain semantics accepted"

It does not calculate or persist production BOM, edge, labor, cost, tax, margin, quote totals, nesting, or production quantities.

## P6 Persisted Wardrobe Slice

`calculateWardrobeQuoteSnapshot` in `apps/web/lib/server/quoteCalculation.ts` is the current authoritative slice for Supabase-backed demo flow. It uses integer millimetres, integer minor-unit money, basis points for waste/markup/VAT, grouped BOM parts, canonical edge rows, unit labor multiplied by configured product quantity, setup labor, and deterministic SHA-256 hashes.

Persistence is handled by `supabase/migrations/0007_persist_quote_calculation_snapshots.sql`, which inserts/reuses matching BOM and cost snapshots, appends `quote_snapshot_calculated`, and completes the scoped idempotency record in one database RPC. The route rejects browser-supplied totals, status, tenant, actor, snapshot, PDF, approval, and production fields.

Current limitations:

- Only `wardrobe` configuration drafts are supported.
- Demo default prices are deterministic placeholders until price-observation adapters exist.
- No nesting solver, official PDF, quote send, approval, production package, or persisted fork/diff is activated.
- The calculation currently lives in the Next.js server layer because local Go/Docker/Make validation is unavailable on this machine; moving it behind the long-term backend/domain service remains roadmap work.

## API

`POST /api/v1/calculations/boundary-preview`

This endpoint validates the contract payload and returns the non-authoritative preview response. It is useful for tests and future integration wiring only.

The older `/api/v1/nesting/preview` endpoint also returns `authoritative_calculation: false` and no longer returns a synthetic sheet count.

## Golden Tests

`services/compute/tests/test_calculation_contracts.py` covers:

- invalid dimensions rejected
- money minor units enforced
- quantity units and no binary float enforcement
- target gross margin lower than 100%
- deterministic contract hash stability
- endpoint returns non-authoritative mode
- endpoint-level invalid payloads return sanitized 422 errors without echoing rejected input values
- nesting preview does not return sheet counts
