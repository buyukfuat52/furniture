# Code Review Policy

Review in this order:
1. Tenant isolation and authorization.
2. Financial and dimensional correctness.
3. Revision immutability and provenance.
4. Idempotency, transaction boundaries and event consistency.
5. Prompt/tool injection and external-action approval.
6. Data loss, concurrency and retry behavior.
7. Test coverage and reproducibility.
8. Accessibility, UX and maintainability.

Findings must include severity, evidence, impact and a concrete remediation. Ignore style-only preferences unless they hide a correctness or maintenance risk.
