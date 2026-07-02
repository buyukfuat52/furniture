# Go Core Service Instructions
- Keep domain packages free of infrastructure dependencies.
- Use explicit transactions and a transactional outbox.
- Enforce `company_id` in every tenant repository method and authorization boundary.
- Money and dimensions use exact canonical types.
- Use table-driven and golden tests for formulas.
- Commands require idempotency keys; consumers record processed event IDs.
- Approved/sent revisions are immutable at both service and persistence layers.
- HTTP handlers remain thin and map structured errors consistently.
