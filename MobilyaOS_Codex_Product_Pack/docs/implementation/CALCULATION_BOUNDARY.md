# Calculation Boundary Scaffolding

Status: Phase 3 scaffold only. This is not the production calculation engine.

## Purpose

The compute service now contains typed contracts for future deterministic furniture calculations. These contracts make the boundary explicit before authoritative BOM, edge, labor, material cost, pricing, and quote-total engines are wired to persistence.

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
