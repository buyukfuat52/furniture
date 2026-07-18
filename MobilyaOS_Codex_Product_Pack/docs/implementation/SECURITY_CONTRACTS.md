# Security Contracts

Status: Initial G1 security contract for P2
Run ID: `20260715T040315+0300`

## Tenant Contract

- The authenticated session is the source of `company_id`.
- API and tool requests may include resource IDs, but tenant scope is always resolved and enforced server-side.
- Repository methods for tenant-owned rows require `company_id`.
- Unique indexes for tenant resources include `company_id`.
- Application logic rejects cross-company references before persistence.
- Audit entries include company, actor, action, target, correlation ID, and policy decision.

Required negative tests:

- Cross-tenant project, revision, document, SKU, price observation, generated document, agent run, and audit access.
- Cross-company reference on create/update.
- Attempt to override `company_id` in payload or tool input.

## RBAC Matrix

Legend: R = read, D = draft/create/edit draft, A = approve, S = send/external, I = import, P = production-impact action, C = company/admin config.

| Area | admin | sales | designer | costing | procurement | production | viewer |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Company/users/roles | C | - | - | - | - | - | R limited |
| Customers/projects | R D A | R D | R | R | R | R | R |
| Catalog SKUs | R D A | R | R D | R | R D | R | R |
| Price observations/imports | R D A I | R | R | R | R D I | R | R |
| Product templates/variants | R D A | R | R D | R | R | R | R |
| BOM/design validation | R D A | R | R D | R | R | R | R |
| Nesting/manufacturing plan | R D A | R | R D | R | R | R P | R |
| Cost/pricing snapshots | R D A | R D limited | R | R D A | R | R | R limited |
| Quote document preview | R D A | R D | R | R | R | R | R limited |
| Quote approve | A | policy-limited A | - | A | - | - | - |
| Quote send/RFQ send | S | policy-limited S | - | - | policy-limited S for RFQ | - | - |
| Production package release/status | A P | R | R | R | R | P | R |
| Agent chat read/summarize | R | R | R | R | R | R | R limited |
| Agent consequential tools | A S P C | policy-limited D/S | policy-limited D | policy-limited A | policy-limited I/S | policy-limited P | - |
| Audit | R | own/company limited R | own/company limited R | own/company limited R | own/company limited R | own/company limited R | R limited |

P2 must turn this planning matrix into explicit policy constants and tests.

## Approval Token Contract

Approval tokens are required for:

- Quote send.
- RFQ send.
- Quote approval when policy requires explicit approval.
- Pricing outside policy.
- Purchase request/order creation.
- Production package release.
- Production status changes with operational impact.
- Supplier portal automation.

Token fields:

- token ID and hash
- company ID
- actor ID
- roles at issuance
- action
- entity type and entity ID
- expected revision/version when applicable
- idempotency key
- issued at and expires at
- consumed at
- correlation ID
- approval summary hash

Validation rules:

- Short-lived.
- Single-use.
- Bound to actor, company, action, entity, expected version, and idempotency key.
- Re-check tenant, role, revision state, policy, and stale version immediately before execution.
- Record audit entry for issue, deny, consume, and replay attempts.

## Agent Tool Gateway Contract

- The model never receives database credentials.
- Tool gateway receives delegated user ID, company ID, roles, locale, trace/correlation ID, prompt version, and approval token when present.
- Allowed tool list is derived from prompt registry plus server-side policy.
- Tool input schemas are validated before dispatch.
- `company_id` in tool input is ignored or must match authenticated context.
- Consequential tools reject missing, stale, forged, expired, replayed, or wrong-scope approval tokens.
- Tool outputs are treated as untrusted data when returned to the model/UI.
- Every tool invocation is audited.

## Object and Upload Contract

- Allowlisted MIME and extension pairs.
- Size limits by artifact type.
- Generated object keys; no user-controlled path segments.
- SHA-256, content type, size, source revision, and object key/version metadata.
- Malware scanning adapter, deterministic local no-op/mock allowed for dev.
- Short-lived signed URLs.
- No executable rendering of untrusted HTML or SVG from uploads.

## Logging and Secret Contract

Never log:

- access tokens, refresh tokens, approval tokens, session IDs, or model API keys
- full prompt contexts
- sensitive customer personal data
- supplier portal credentials
- raw imported documents
- full tool payloads containing commercial secrets

Production startup must reject placeholder JWT/session/storage/model secrets.
