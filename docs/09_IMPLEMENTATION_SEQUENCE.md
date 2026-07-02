# Implementation Sequence

## Phase 0 — Repository and contracts
- monorepo layout
- task runner, Docker Compose, CI
- shared schemas and ADRs

## Phase 1 — Identity, tenant and catalog
- auth, sessions, RBAC
- company scoping
- catalog and price observations
- seed data

## Phase 2 — Project, product and calculations
- projects/revisions/items
- template engine for two supported products
- BOM, edge-band, hardware, operations/labor
- golden tests

## Phase 3 — Nesting, costing and quote
- deterministic nesting adapter and viewer
- cost/pricing snapshots
- PDF generation and object storage
- approval/immutability

## Phase 4 — Revision and agent
- fork and semantic diff
- audit timeline
- prompt registry, tool gateway, fake model and provider adapter
- prompt/tool evals

## Phase 5 — Product polish and verification
- Turkish UX refinement
- E2E flow
- threat model and negative tests
- observability, docs, clean bootstrap
