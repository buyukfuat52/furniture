# ADR-0001: Modular Monolith, Web App, and Compute Service Architecture

Status: Accepted for P1 planning
Date: 2026-07-15

## Context

MobilyaOS needs deterministic CPQ/manufacturing calculations, project/revision workflows, generated documents, auditability, and controlled agentic operations. The product docs prescribe a monorepo with a Next.js web app, Go core modular monolith, Python compute/agent-support service, shared contracts, and local infrastructure.

## Decision

Use the documented architecture as the initial product architecture:

- `apps/web`: Next.js TypeScript strict-mode UI.
- `services/core`: Go modular monolith owning authoritative domain behavior and persistence.
- `services/compute`: Python FastAPI compute/agent-support process for adapters, prompt/model support, and optional deterministic computational helpers.
- Shared contracts for OpenAPI, AsyncAPI, JSON Schema, and generated clients.
- PostgreSQL, object storage, NATS JetStream, and workflow adapter behind ports.

Domain packages in the Go core must remain independent of HTTP, SQL, NATS, S3, Temporal, and model SDKs.

## Consequences

- P2 starts with executable contracts and foundations, not feature breadth.
- Backend, frontend, and AI work can fan out only after shared contracts are explicit.
- Deterministic calculations remain server-side and testable.
- Compute service cannot become an authority for business totals unless the contract explicitly delegates a deterministic adapter and provenance is stored.

## Risks

- Local PATH is missing Go, Docker, and make, so later implementation and verification need toolchain remediation.
- Windows development may require a cross-platform task runner while preserving required `make` semantics or documenting an equivalent.
