# Test and Acceptance Strategy

## Domain tests
- Golden BOM for wardrobe and kitchen base cabinet.
- Edge-band length and cost by individual edge and quantity.
- Unit labor multiplied by product quantity; setup labor not multiplied incorrectly.
- Exact money, markup, target gross margin, discount, VAT and rounding.
- Nesting reproducibility, no overlap, bounds, kerf/trim and grain constraints.
- Immutable approved revision.
- Cost snapshot reproducibility from frozen observations.

## Integration tests
- PostgreSQL repositories and tenant predicates.
- Outbox publish and idempotent consume.
- Object storage upload/hash/read metadata.
- PDF generation.
- Revision fork and diff.
- Tool gateway authorization.

## Contract tests
- OpenAPI validity and request/response examples.
- AsyncAPI and CloudEvents examples.
- Runtime prompt registry references.
- JSON Schema validation for agent/tool outputs.

## E2E acceptance
1. Login as sales demo user.
2. Create/select a customer and project.
3. Build a wardrobe quote with quantity > 1.
4. Verify BOM, edge-band and labor values are shown.
5. Run nesting and view sheets/utilization.
6. Apply pricing and generate PDF.
7. Approve revision and verify editing is blocked.
8. Fork revision, change material/dimension, recalculate.
9. View semantic diff and cost delta.
10. Ask assistant to find and summarize the quote.
11. Attempt unauthorized external send as viewer and verify denial.

## Quality gates
- No failing tests.
- No TypeScript errors.
- No Go vet/static errors.
- No Python lint/type errors.
- Production builds succeed.
- Critical/high threat findings resolved.
- Core Web Vitals are reasonable in local production build.
- No secrets in repository scan.
