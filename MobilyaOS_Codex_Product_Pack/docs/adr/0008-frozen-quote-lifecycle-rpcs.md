# ADR-0008: Frozen Quote Lifecycle RPCs

Status: accepted

Date: 2026-07-18

## Context

P7 needed the first Supabase-backed quote lifecycle after deterministic cost snapshot calculation: frozen quote document generation, revision fork, revision diff, and approval-gate preparation.

The product rules require deterministic totals, tenant isolation, immutable approved/sent revisions, exact money, and no LLM authority over costs. The browser must not provide company, actor, role, quote status, total, document hash, snapshot hash, approval token, or storage locator authority.

## Decision

MobilyaOS will persist P7 quote lifecycle mutations through service-role-only Supabase RPCs called from trusted Next.js server routes.

The server routes:

- derive company, user, and role from the HTTP-only local-demo session
- allowlist request bodies
- reserve durable idempotency by company, actor, action, and hashed idempotency key
- fetch authoritative revision, configuration, snapshot, and document records server-side
- return sanitized DTOs only

The RPCs validate and persist:

- frozen quote documents bound to revision version, cost snapshot ID, calculation version, snapshot hash, document version, and document SHA-256
- revision forks that create draft children and copy configuration input only
- approval gates bound to revision version, frozen document, document hash, cost snapshot, snapshot hash, expiry, and approval token version

Authenticated public-key direct reads of sensitive generated-document and approval rows are blocked. Application document and approval reads must go through server routes that omit storage bucket/path, token hashes, raw tokens, and internal-only metadata.

Read-only runtime agent/chat tools may summarize trusted server-fetched document and diff facts. They cannot calculate costs, generate PDFs, send quotes, approve quotes, or create production packages.

## Consequences

- P7 lifecycle state is auditable and idempotent for the current Supabase-backed path.
- Quote document totals are generated from the persisted cost snapshot, not from browser or LLM values.
- Forked revisions cannot inherit frozen snapshots, documents, approvals, send state, or production state.
- The first quote artifact is deterministic HTML. Binary PDF generation, object-storage uploads, approval-token consumption, quote send, and production package creation remain future work.
- The long-term Go core repository path should either adopt the same invariants or replace these Next.js server-boundary adapters with equivalent backend commands.
