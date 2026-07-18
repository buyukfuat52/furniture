# ADR-0003: Phase Gates, File Ownership, and Contract Freeze

Status: Accepted for P1 planning
Date: 2026-07-15

## Context

The repository includes a machine-readable workflow and file ownership policy. The current user request limits the first round to P0 and P1 and asks to see the plan before large-scale backend/frontend coding.

## Decision

Follow the phase order in `.codex/orchestration/workflow.yaml` exactly:

1. P0 repository survey.
2. P1 discovery and contract readiness.
3. P2 executable contracts and foundations.
4. P3 vertical slice.
5. P4 adversarial review and repair.
6. P5 release verification.

The parent session owns shared files and grants leases for shared paths. Agents may write only within assigned ownership. Reviewers remain read-only for production code. Backend/frontend/AI implementation fan-out is blocked until G1 passes and affected contracts are frozen.

## Consequences

- This round creates planning/status/ADR artifacts only.
- P2 cannot start until P1 handoffs are consolidated and G1 criteria are recorded.
- Contract changes after freeze must use the documented handoff protocol.

## Risks

- The product prompt requests a full one-shot build, but the active user scope restricts this run to P0/P1. Future rounds must resume from the recorded gate state.
