# ADR-0006: P2 Foundation Tooling and Service Skeleton

Status: Accepted for P2 foundation
Date: 2026-07-15

## Context

P2 needs an executable monorepo skeleton without attempting the full product slice. The local environment lacks Go, Docker, and make on PATH, so the first pass must create foundations that can be verified once the toolchain is available.

## Decision

- Use a root `Makefile` with the required commands: `bootstrap`, `dev`, `test`, `lint`, `typecheck`, `verify`, `seed`, `demo`, and `clean`.
- Use npm workspaces for `apps/web` and `packages/*`.
- Use Go standard-library HTTP for the first `services/core` foundation.
- Use Next.js 14 strict TypeScript for `apps/web`.
- Use Python FastAPI for `services/compute`.
- Use Docker Compose for PostgreSQL, NATS JetStream, MinIO, and the three app processes.
- Keep P2 data in memory for the core demo endpoints while migrations define the intended PostgreSQL foundation.

## Consequences

- The foundation is inspectable and avoids early framework lock-in beyond the documented target stack.
- P3 must not rely on in-memory demo state for production behavior.
- `make verify` is defined but cannot be executed in the current PATH until make, Go, Docker, and dependencies are installed.

## Risks

- Docker and Makefile behavior is unverified locally.
- Frontend dependencies are declared but not installed yet.
- Contract validation and generated clients remain P2 follow-up work.
