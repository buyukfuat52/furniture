# ADR-0005: RBAC, Approval Tokens, and Agent Tool Gateway Enforcement

Status: Accepted for P1 planning
Date: 2026-07-15

## Context

MobilyaOS includes agent-assisted operations, but models cannot exceed the delegated user's role or tenant access. Consequential actions require explicit approval handling.

## Decision

- Authorization is enforced server-side for REST endpoints and agent tools.
- `company_id` is derived from authenticated context and checked against stored tenant ownership; user/model-supplied tenant IDs are not trusted.
- P2 must create an endpoint/action and tool/action RBAC matrix for admin, sales, designer, costing, procurement, production, and viewer.
- Approval tokens are short-lived, single-purpose, company/actor/entity/action/revision-version/idempotency bound, replay-protected, and audited.
- The tool gateway validates schema, tenant, role, approval state, idempotency, and stale revision/version checks immediately before executing any tool call.

## Consequences

- Prompt text is not treated as a security control.
- Every consequential action needs negative tests for role, tenant, forged token, replay, stale revision, and missing approval.
- Tool schemas should narrow broad payload objects per action where possible.

## Risks

- Existing tool catalog fields are broad. P2 must either split schemas per action or add strict runtime validation.
