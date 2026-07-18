# ADR-0007: Durable Supabase Idempotency For Draft Mutations

Date: 2026-07-18

## Status

Accepted for the Supabase Cloud development path.

## Context

P5.5 draft mutation routes used a process-local idempotency map. That protected a single running Next.js process, but it did not survive process restarts, serverless replays, or multiple web instances.

Mutation commands must be idempotent and tenant-scoped. Raw idempotency keys must not be stored or returned, and browser-provided tenant, actor, role, status, or audit fields are never authority.

## Decision

Use a Supabase-backed `public.idempotency_records` table for current draft mutation routes.

Records are scoped by:

- `company_id`
- `actor_app_user_id`
- `action`
- SHA-256 hash of the caller idempotency key

The request body is represented by a canonical SHA-256 hash. Same scoped key and same request hash replays the stored sanitized response. Same scoped key and different request hash returns `409 Idempotency conflict`. Same scoped key while the first request is still in progress returns `409 Request already in progress`.

The reservation is made through a small database RPC so insert-or-read is atomic. Completion stores only status code and sanitized JSON response. Raw keys, cookies, database URLs, service keys, and token-like values are not stored.

## Consequences

- Draft customer, project, and quote-draft POST routes now survive a Next.js process restart for replay behavior.
- Idempotency cannot replay across another actor, tenant, or action.
- The implementation is not a full business transaction across the idempotency row plus domain write plus audit append because current web routes use Supabase REST calls rather than a single SQL transaction.
- Expired in-progress reservations are cleared by the RPC only for the same scoped key. A later maintenance job can prune old rows globally.
- Future runtime-agent mutation tools must supply or receive a server-generated scoped idempotency key before dispatch.
