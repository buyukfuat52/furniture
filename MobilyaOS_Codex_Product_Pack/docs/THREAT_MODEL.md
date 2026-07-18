# Threat Model

Status: Initial P1 threat model
Run ID: `20260715T040315+0300`

## Scope

This threat model covers the planned MobilyaOS vertical slice: local demo authentication, tenant-scoped catalog/project/quote data, deterministic calculations, generated documents, revision approval/fork/diff, object storage, events/workflows, and authorized agent chat.

## Trust Boundaries

- Browser to web/API.
- API to PostgreSQL, object storage, event bus, and workflow adapter.
- Core service to compute/model provider.
- Core service to supplier/customer external systems.
- Uploaded files, imported CSV/PDF content, retrieved documents, and external text.
- Model output to tool gateway and approval workflow.

## High-Risk Abuse Cases

| Risk | Scenario | Required Control | Required Test |
| --- | --- | --- | --- |
| Cross-tenant IDOR | User guesses another company's project, revision, document, SKU, or tool run ID. | Company ID from authenticated context; repository predicates; no trusting payload `company_id`; cross-company FK prevention. | Cross-tenant read/write/delete denial tests. |
| Role escalation | Viewer or sales user calls costing, approval, production, procurement, or send action. | Per-endpoint and per-tool RBAC matrix. | Role/action negative tests for every consequential action. |
| Approval bypass | Model or user supplies fake approval token or replays an old token. | Short-lived single-purpose approval tokens bound to company, actor, action, entity, revision/version, and idempotency key. | Forged, expired, replayed, wrong-actor, wrong-entity approval-token tests. |
| Prompt injection | External content tells the assistant to reveal secrets, send quotes, or ignore rules. | External content labeled as data; schema validation; tool gateway authorization after model selection. | Prompt-injection and tool-output-injection evals. |
| Unsafe uploads | Malicious file name, MIME mismatch, object key traversal, executable HTML preview. | Allowlisted MIME/extension/size, generated object keys, scan adapter, no executable rendering, short-lived signed URLs. | Upload validation and object-key traversal tests. |
| Secret leakage | Logs/traces/prompts/tool payloads include tokens, customer data, supplier credentials, or raw external docs. | Redaction policy; no full prompt logging; production startup rejects placeholder secrets. | Secret scan and logging redaction tests. |
| Immutable revision bypass | Approved/sent quote revision is edited through API, worker, import, or agent tool. | Service and persistence update guards; fork-only mutation path. | Immutable revision mutation negative tests. |
| Numeric tampering | Browser/model-proposed totals are persisted as authoritative. | Server-side deterministic calculation services only; provenance snapshots. | Contract and integration tests reject client/model authoritative totals. |
| Event replay or duplicate command | Outbox consumer or command is replayed. | Idempotency keys and inbox consumption records. | Idempotency/replay tests. |

## Required P2 Security Contracts

- Endpoint/action RBAC matrix for admin, sales, designer, costing, procurement, production, and viewer.
- Tool authorization matrix matching prompt registry allowed tools plus server-side roles and approval state.
- Tenant repository contract: authenticated company ID is mandatory, all tenant reads/writes filter by it, and cross-company references fail.
- Approval token contract: binding, expiry, replay prevention, version/revision checks, idempotency, audit fields.
- Object/file contract: generated keys, MIME/extension/size checks, scan adapter, signed URL policy, hash metadata.
- Logging/redaction policy: no secrets, full prompts, sensitive customer data, supplier credentials, or raw external documents.
- Production config validation: placeholder secrets fail startup outside development.

## Current Findings

- No production code exists yet, so no implementation vulnerabilities were confirmed.
- Security readiness is conditional because RBAC/action, approval-token, tenant repository, upload/object, and logging contracts are not executable yet.
- Existing tool schemas contain broad payload fields; P2 should narrow or validate per action to avoid overposting and confused-deputy writes.

## Residual Risks

- Remote repository state has not been verified.
- Tool and prompt schemas are specification assets only; there is no runtime enforcement or eval runner yet.
- Demo credentials in `config/env.example` must remain development-only and fail production validation if unchanged.
