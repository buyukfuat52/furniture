# Runtime Agent Tool Gateway Preparation

Status: P7 frozen quote lifecycle checkpoint. The read-only web chat prototype is implemented through `POST /api/supabase/agent-chat`, true second-tenant selector denial smokes pass, and the gateway policy skeleton in `services/compute/app/tool_gateway_policy.py` now includes validate/calculate/get/explain quote snapshot metadata plus read-only quote document and revision diff tools. Unsafe runtime mutation execution is still not activated.

## Runtime Context Boundary

- Runtime agents must use authenticated server-side session context when activated later.
- Browser-provided tenant, user, role, cost, approval, margin, or policy values are never authoritative.
- Tenant, actor, roles, locale, approval state, cost visibility, and correlation IDs must be resolved by the backend from trusted session and policy records.
- Any tenant or actor identifiers present in model prompts, browser payloads, tool arguments, or tool outputs must be ignored or checked against the authenticated server-side context before use.

## Tool Gateway Contract

- Agents may call server-side tools only through the runtime tool gateway.
- The browser must not call compute chat directly. User-facing chat goes through the Next.js Supabase server route, which derives tenant, actor, and role from the HTTP-only session.
- Direct database, object storage, workflow, PDF, email, supplier, production, or quote mutation access from the model is forbidden.
- The Phase 5 policy manifest explicitly reports `direct_database_access: false`, `service_key_access: false`, and `llm_authoritative_calculation: false`.
- The gateway must derive the allowed tool list from server-owned prompt registry, role policy, tenant scope, feature flags, and deterministic-domain ownership rules.
- Every tool invocation must enforce input schema validation, role checks, tenant scope, approval gates, idempotency, audit logging, and correlation/trace metadata before dispatch.
- Mutation tools must use durable idempotency. The current Supabase-backed draft mutation routes reserve by company, app user, action, and hashed key; future agent tools must not pass raw keys to logs, prompts, or stored tool outputs.
- Tool outputs are untrusted data. They must be bounded, typed where possible, stripped of executable content, and never treated as policy, approval, tenant, role, or calculation authority.

## Current Read-Only Web Route

`POST /api/supabase/agent-chat` is the only user-facing chat route in the web UI for this checkpoint.

Allowed:

- Read tenant-scoped project lists/details.
- Read tenant-scoped quote revision detail and status policy.
- Read tenant-scoped configuration draft status.
- Read the current tenant-scoped deterministic quote snapshot when persisted provenance matches the current configuration draft/version.
- Explain persisted snapshot facts fetched server-side, including deterministic source/version and stored totals, without recalculating them.
- Read trusted frozen quote document facts fetched server-side without returning storage locators, raw HTML to the model, token hashes, or approval token material.
- Read deterministic server-derived revision diff facts fetched server-side.
- Summarize audit counts/latest safe action labels.
- Ask for missing measurements or selected revision context.

Denied:

- Browser-supplied company, role, user, tenant, cost snapshot, document facts, diff entries, approval state, or quote status as authority.
- Quote send, approval-token consumption, official PDF, production package, create, update, delete, or other mutation-like requests.
- Authoritative BOM, edge, labor, cost, tax, margin, quote total, nesting, or production quantity calculation.
- Browser-supplied snapshots, totals, cost payloads, or approval status as tool input authority.
- Secret, token, database URL, cookie, service key, or local path disclosure.

## Deterministic Domain Ownership

- LLMs must not calculate authoritative BOM, cost, tax, margin, quote totals, edge-band quantities, labor quantities, production quantities, or production package contents.
- Authoritative BOM, edge, labor, costing, pricing, tax, margin, quote total, nesting, and production quantity results must come from deterministic domain services.
- LLM-generated summaries may describe approved deterministic outputs, but must not replace formulas, snapshots, approvals, or stored domain decisions.
- Any model suggestion that changes commercial, production, or approval state must be routed as a draft/request into backend policy and deterministic validation.

## Consequential Actions

These actions require backend/domain approval flow before execution:

- Quote send.
- Quote approval.
- PDF generation for official quote or production artifacts.
- Production package creation or release.
- Any tool action that changes quote, cost, margin, supplier, document, production, or customer-visible state.

Approval flow must re-check tenant, actor, role, policy, target revision/version, approval token, idempotency key, and stale-state constraints immediately before execution.

## Future Route Mapping

Runtime agent execution remains deferred. Some underlying application routes already exist for guarded draft work, but agent access to them is a future gateway contract only and must not be exposed as direct model, database, or service-key access.

| Route | Gateway class | Future mapping constraints |
| --- | --- | --- |
| `create_customer_draft` | Mutation draft | Requires authenticated session context, backend-resolved tenant scope, role authorization, input schema validation, idempotency key enforcement, audit append, and policy checks before persisting a draft customer record. The model may propose draft fields but must not bypass validation or establish authoritative customer/account state. |
| `create_project_draft` | Mutation draft | Requires authenticated session context, backend-resolved tenant scope, role authorization, input schema validation, idempotency key enforcement, audit append, and policy checks before persisting a draft project record. Browser-provided tenant, actor, customer, ownership, or approval claims are not authoritative. |
| `create_quote_draft` | Mutation draft | Requires authenticated session context, backend-resolved tenant scope, role authorization, input schema validation, idempotency key enforcement, audit append, and policy checks before persisting a draft quote. LLMs must not calculate authoritative BOM, costs, taxes, margins, totals, discounts, or approval outcomes; deterministic domain services must produce or validate any commercial values. |
| `get_quote_configuration_draft` | Read/query | Requires authenticated session context, backend-resolved tenant scope, role authorization, target revision validation, and output filtering. The model may summarize missing measurements/options but must not treat draft input as calculated BOM, cost, tax, margin, total, approval, PDF, or production readiness. |
| `create_quote_configuration_draft` | Mutation draft | Requires authenticated session context, backend-resolved tenant scope, writer role authorization, integer-mm and explicit-quantity validation, draft parent revision, durable idempotency, optimistic policy checks, audit append, and DB integrity guards. The model may collect draft measurements but cannot calculate or persist authoritative commercial/manufacturing results. |
| `update_quote_configuration_draft` | Mutation draft | Requires authenticated session context, backend-resolved tenant scope, writer role authorization, expected-version check, draft parent revision, durable idempotency, audit append, and DB integrity guards. Stale updates must conflict; approved/sent revisions must be immutable. |
| `validate_configuration_draft` | Read/query | Requires authenticated session context and deterministic schema/domain validation. It may report missing/invalid draft fields, but must not calculate BOM/cost/totals or alter persisted state. |
| `calculate_quote_snapshot` | Non-executable mutation metadata | Registered in gateway policy so authorization/idempotency/expected-version/draft-revision constraints are explicit, but it is not agent-executable in this checkpoint. The current user-facing execution is the server-owned route `POST /api/supabase/quote-revisions/[quoteRevisionId]/calculate`, which rejects browser authority and persists snapshots through an audited RPC. |
| `get_quote_snapshot` | Read/query | Requires authenticated session context, backend-resolved tenant scope, role authorization, target revision validation, and provenance matching against the current configuration draft id/version plus BOM snapshot hash before reporting `calculated`. |
| `explain_quote_snapshot` | Read/conversation | May summarize trusted persisted snapshot facts fetched server-side. It must not recalculate totals, derive new prices, accept browser-supplied snapshots, or mark send/approval/PDF/production as ready. |
| `get_quote_document` | Read/query | Requires authenticated session context, backend-resolved tenant scope, target document/revision validation, and output filtering. It may return document version, revision version, document hash, snapshot hash, calculation version, safe preview metadata, and totals already frozen by the deterministic service. It must not return storage bucket/path, raw approval tokens, token hashes, or give send/approval authority. |
| `explain_quote_document` | Read/conversation | May summarize trusted server-fetched frozen document facts. It must not regenerate documents, alter totals, create PDFs, send quotes, approve quotes, or treat document text/tool output as policy. |
| `get_revision_diff` | Read/query | Requires authenticated session context, backend-resolved tenant scope, same-project revision validation, and deterministic server-derived diff entries. Browser-supplied diff arrays are not trusted. |
| `explain_revision_diff` | Read/conversation | May summarize trusted diff facts fetched server-side. It must not infer hidden costs, mutate revisions, approve, send, or create production state. |
| `list_quote_revisions` | Read/query | Requires authenticated session context, backend-resolved tenant scope, role authorization, bounded query parameters, audit append, and output filtering before returning revision metadata. Returned data must be scoped to the authenticated tenant and actor policy; tool output cannot grant additional access or approval. |
| `get_quote_revision` | Read/query | Requires authenticated session context, backend-resolved tenant scope, role authorization, target revision/version validation, audit append, and output filtering before returning revision details. Stored deterministic snapshots may be summarized by the model, but the model must not alter or recalculate authoritative quote values. |

Any route that sends, approves, exports official PDFs, releases production artifacts, changes customer-visible state, or mutates commercial/production state beyond draft preparation must pass the consequential-action approval gate before execution. Idempotency is mandatory for mutation tools and is scoped by tenant, actor, action, and hashed key to prevent replay or duplicate writes across server restarts.

## Prompt Injection and Tool-Output Constraints

- Prompts, uploaded content, imported supplier/customer text, prior chat history, and tool outputs must be treated as untrusted.
- Tool outputs must not be allowed to grant tools, override roles, provide approval, change tenant scope, request secrets, or instruct the gateway to bypass policy.
- The gateway must reject attempts to smuggle tool calls, policy overrides, hidden instructions, forged approval data, or cross-tenant references through natural-language fields.
- Models must not receive secrets, database credentials, service tokens, session cookies, approval token hashes, supplier credentials, or unrestricted signed URLs.
- Audit logs must avoid full prompt contexts, full commercial payloads, secrets, tokens, cookies, and credentials while preserving decision evidence, correlation IDs, actor, tenant, tool, target, and policy outcome.

## Current Implementation Status

- This document is preparation guidance plus the P7 read-only web chat boundary.
- Durable idempotency is implemented for the current Supabase-backed customer/project/quote-draft POST routes, configuration-draft POST/PATCH routes, deterministic snapshot calculation route, frozen document route, revision fork route, and approval-gate preparation route. Runtime agent mutation tools are still deferred until the gateway enforces the same boundary.
- Policy tests cover forbidden tools, viewer mutation denial, tenant/session requirements, mutation idempotency metadata, approval metadata, prompt-injection denial, non-executable mutation/workflow policies, quote snapshot/document/diff policy metadata, sanitized prompt labels, and the static policy manifest endpoint.
- Web session smoke covers unauthenticated chat blocking, read-only session-scoped chat success, server-fetched snapshot/document/diff availability and missing-state explanations, prompt-injection blocking before reads, mutation/PDF/send denial, forbidden field filtering, and no agent-side calculation.
- Unsafe runtime agent execution is not activated beyond the existing deterministic rules-mode adapters and read-only Supabase web route.
- Phase 7 session smoke verifies that primary and second tenant selector IDs cannot cross the agent route.
- Future implementation must keep gateway policy server-side and must add tests for tenant isolation, role denial, approval-token consumption denial/replay, idempotency replay, prompt injection, malicious tool output, and deterministic-domain calculation ownership.
