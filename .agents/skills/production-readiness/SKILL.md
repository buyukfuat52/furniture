---
name: production-readiness
description: Use before declaring a feature or repository complete; performs build, test, security, documentation, and clean-bootstrap verification. Do not use for exploratory design-only tasks.
---

# Production Readiness Workflow

1. Review `docs/10_DEFINITION_OF_DONE.md`.
2. Run formatter, lint, type checks, unit/integration/contract/E2E tests, and production builds.
3. Verify clean database migration and deterministic seed.
4. Verify no tracked secrets and no critical/high security finding.
5. Review the final diff for regressions, dead code, TODOs and false claims.
6. Update `docs/implementation/STATUS.md` with commands and outcomes.
7. Report failed or skipped checks explicitly.
