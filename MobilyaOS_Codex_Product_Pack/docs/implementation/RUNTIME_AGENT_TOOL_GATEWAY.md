# Runtime Agent Tool Gateway Preparation

Status: Preparation only for P5.4/P5.5. Unsafe runtime tool execution is not activated.

## Runtime Context Boundary

- Runtime agents must use authenticated server-side session context when activated later.
- Browser-provided tenant, user, role, cost, approval, margin, or policy values are never authoritative.
- Tenant, actor, roles, locale, approval state, cost visibility, and correlation IDs must be resolved by the backend from trusted session and policy records.
- Any tenant or actor identifiers present in model prompts, browser payloads, tool arguments, or tool outputs must be ignored or checked against the authenticated server-side context before use.

## Tool Gateway Contract

- Agents may call server-side tools only through the runtime tool gateway.
- Direct database, object storage, workflow, PDF, email, supplier, production, or quote mutation access from the model is forbidden.
- The gateway must derive the allowed tool list from server-owned prompt registry, role policy, tenant scope, feature flags, and deterministic-domain ownership rules.
- Every tool invocation must enforce input schema validation, role checks, tenant scope, approval gates, idempotency, audit logging, and correlation/trace metadata before dispatch.
- Tool outputs are untrusted data. They must be bounded, typed where possible, stripped of executable content, and never treated as policy, approval, tenant, role, or calculation authority.

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

Runtime agent execution remains deferred. These planned/persisted routes are future gateway contracts only and must not be exposed as direct model, database, or service-key access.

| Route | Gateway class | Future mapping constraints |
| --- | --- | --- |
| `create_customer_draft` | Mutation draft | Requires authenticated session context, backend-resolved tenant scope, role authorization, input schema validation, idempotency key enforcement, audit append, and policy checks before persisting a draft customer record. The model may propose draft fields but must not bypass validation or establish authoritative customer/account state. |
| `create_project_draft` | Mutation draft | Requires authenticated session context, backend-resolved tenant scope, role authorization, input schema validation, idempotency key enforcement, audit append, and policy checks before persisting a draft project record. Browser-provided tenant, actor, customer, ownership, or approval claims are not authoritative. |
| `create_quote_draft` | Mutation draft | Requires authenticated session context, backend-resolved tenant scope, role authorization, input schema validation, idempotency key enforcement, audit append, and policy checks before persisting a draft quote. LLMs must not calculate authoritative BOM, costs, taxes, margins, totals, discounts, or approval outcomes; deterministic domain services must produce or validate any commercial values. |
| `list_quote_revisions` | Read/query | Requires authenticated session context, backend-resolved tenant scope, role authorization, bounded query parameters, audit append, and output filtering before returning revision metadata. Returned data must be scoped to the authenticated tenant and actor policy; tool output cannot grant additional access or approval. |
| `get_quote_revision` | Read/query | Requires authenticated session context, backend-resolved tenant scope, role authorization, target revision/version validation, audit append, and output filtering before returning revision details. Stored deterministic snapshots may be summarized by the model, but the model must not alter or recalculate authoritative quote values. |

Any route that sends, approves, exports official PDFs, releases production artifacts, changes customer-visible state, or mutates commercial/production state beyond draft preparation must pass the consequential-action approval gate before execution. Idempotency is mandatory for mutation tools and should be checked before and after backend policy validation to prevent replay or duplicate writes.

## Prompt Injection and Tool-Output Constraints

- Prompts, uploaded content, imported supplier/customer text, prior chat history, and tool outputs must be treated as untrusted.
- Tool outputs must not be allowed to grant tools, override roles, provide approval, change tenant scope, request secrets, or instruct the gateway to bypass policy.
- The gateway must reject attempts to smuggle tool calls, policy overrides, hidden instructions, forged approval data, or cross-tenant references through natural-language fields.
- Models must not receive secrets, database credentials, service tokens, session cookies, approval token hashes, supplier credentials, or unrestricted signed URLs.
- Audit logs must avoid full prompt contexts, full commercial payloads, secrets, tokens, cookies, and credentials while preserving decision evidence, correlation IDs, actor, tenant, tool, target, and policy outcome.

## Current Implementation Status

- This document is preparation guidance for runtime-agent and tool-gateway hardening.
- Unsafe runtime agent execution is not activated.
- Future implementation must keep gateway policy server-side and must add tests for tenant isolation, role denial, approval denial/replay, idempotency replay, prompt injection, malicious tool output, and deterministic-domain calculation ownership.
