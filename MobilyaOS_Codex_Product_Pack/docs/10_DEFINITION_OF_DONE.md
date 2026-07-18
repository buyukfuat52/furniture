# Definition of Done

The repository is done for this build mission only when all are true:

- A new developer can clone, copy `.env.example`, and run the demo with documented commands.
- The web UI, Go API and compute service run locally with containerized dependencies.
- Seeded users can complete the primary quote flow through the UI.
- Wardrobe and kitchen base-cabinet calculations use real deterministic engines.
- Sheet nesting creates valid placements and a visual result.
- Quote PDF is generated and stored with hash/provenance.
- Approved revision cannot be edited; forked revision can be compared.
- The assistant uses registered tools and structured output; it cannot authoritatively calculate totals.
- Tenant/role negative tests pass.
- Prompt-injection and unauthorized-action tests pass.
- `make verify` succeeds from a clean checkout.
- CI mirrors the verification command.
- Documentation states actual behavior and limitations.
- No critical-path TODO, fake total, dead link, broken navigation, or unhandled empty/error state remains.
