# ADR-0004: Initial Decisions for IDs, Templates, Workflow, and Snapshots

Status: Accepted for P1 planning
Date: 2026-07-15

## Context

P1 handoffs identified several decisions that must be explicit before executable contracts and parallel consumers begin.

## Decision

- Use UUIDs in initial contracts unless a later ADR adopts ULIDs before migrations are created.
- Product templates are versioned. Publishing a template version requires deterministic validation and human approval for production use.
- Template formulas are data-driven contract objects, not executable user-submitted code.
- Use Temporal through a workflow port when available; provide a durable local adapter with compatible semantics for local demo if Temporal is unavailable.
- Calculation snapshots are created by idempotent commands. The authoritative snapshot, provenance records, revision/version check, and outbox event are committed in one transaction where possible.

## Consequences

- P2 contracts must include revision/version checks and idempotency keys on mutating commands.
- Template formula schema must be narrow and testable before frontend or agent consumers create templates.
- Workflow implementation can start locally without external credentials while preserving future Temporal compatibility.

## Risks

- UUIDs do not preserve creation order. If ordered IDs become important, this ADR must be revisited before schema lock-in.
- Template formula schema remains a P2 contract priority.
