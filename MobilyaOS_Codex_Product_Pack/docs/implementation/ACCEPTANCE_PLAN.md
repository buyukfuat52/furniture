# Acceptance Plan

Status: Initial P1 acceptance plan
Run ID: `20260715T040315+0300`

## Blocking Acceptance Areas

Every row in `evals/acceptance_matrix.yaml` is blocking for release. P2/P3 must expand them into executable tests.

| Area | Minimum Test Coverage |
| --- | --- |
| Tenant isolation | Cross-tenant project/revision/document/catalog/tool access is denied. |
| Money precision | Frozen cost snapshot recomputes to identical minor-unit totals. |
| Labor | Unit labor multiplies by product quantity; batch/setup labor follows batch count. |
| Edge banding | North/east/south/west edge consumption includes waste/setup allowance and cost provenance. |
| Nesting | Placements stay in bounds, do not overlap, respect kerf/trim/grain/rotation, and are reproducible. |
| Revision immutability | Approved/sent revisions cannot be edited and must be forked. |
| Documents | Quote PDF metadata stores hash, content type, size, object key/version, and source revision. |
| Agent authority | Agent cannot calculate authoritative totals and cannot run unauthorized/consequential tools. |
| E2E | Seeded user completes quote, approval, fork, diff, and assistant summary flow. |

## Golden Fixtures

P2 should create deterministic fixtures for:

- Wardrobe quantity greater than one.
- Kitchen base-cabinet quote.
- Panel materials, edge bands, hinges, rails, labor operations, suppliers, VAT, and margin policies.
- Historical price observations per core SKU.
- Expected BOM parts, four-edge banding, hardware requirements, operations, labor totals, nesting placements, utilization, offcuts, cost categories, pricing steps, VAT, rounding, and grand total.

## Contract and Schema Tests

- OpenAPI validity, examples, and RFC 7807-style errors.
- AsyncAPI validity and CloudEvents examples.
- JSON Schema validation for agent response, approval request, revision diff, tool error, and tool catalog actions.
- Prompt registry path/version references and required variables.
- Handoff schema validation for agent handoffs.

## Security and Negative Tests

- IDOR and cross-tenant access.
- Role escalation.
- Forged, expired, replayed, wrong-actor, and wrong-entity approval tokens.
- Prompt injection and tool-output injection.
- Unauthorized external send.
- Object key traversal and malicious filename/MIME mismatch.
- Secret/log redaction.
- Immutable revision mutation attempts.

## E2E Path

1. Login as seeded sales user.
2. Create or select customer and project.
3. Build wardrobe quote with quantity greater than one.
4. Verify BOM, edge-band, and labor values are shown.
5. Run nesting and view sheets/utilization.
6. Apply pricing and generate PDF.
7. Approve revision and verify editing is blocked.
8. Fork revision, change material or dimension, recalculate.
9. View semantic diff and cost delta.
10. Ask assistant to find and summarize the quote.
11. Attempt unauthorized external send as viewer and verify denial.

## Verification Gate

Final verification must include formatting, lint, type checks, unit tests, golden tests, integration tests, schema/contract validation, prompt evals, production builds, Playwright E2E, security negative tests, and `make verify` or documented equivalent.
