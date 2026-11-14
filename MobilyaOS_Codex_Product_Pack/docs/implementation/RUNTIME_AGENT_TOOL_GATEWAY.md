# Runtime Agent Tool Gateway Preparation

Status: P14 real provider delivery boundary, webhook readiness, and fail-closed real sent-transition checkpoint. The read-only web chat prototype is implemented through `POST /api/supabase/agent-chat`, true second-tenant selector denial smokes pass, and the gateway policy skeleton in `services/compute/app/tool_gateway_policy.py` now includes validate/calculate/get/explain quote snapshot metadata plus read-only quote document, quote artifact status, PDF artifact status, approval-status, send-gate, send-preparation, delivery-status, provider-status, delivery-attempt status, sandbox acknowledgement status, webhook readiness, real delivery status, real sent-deferred explanation, sandbox-vs-real delivery explanation, not-sent explanation, and revision diff tools. Unsafe runtime mutation execution is still not activated.

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
- Read trusted artifact access metadata, PDF artifact status, approval-gate status, send-preparation status, delivery-outbox status, provider configuration boundary status, delivery-attempt ledger status, sandbox acknowledgement status, webhook readiness, real delivery status, sandbox-vs-real delivery facts, and not-sent reasons fetched server-side without generating artifacts, consuming tokens, approving from chat, changing quote status from chat, recording delivery attempts from chat, consuming webhooks, or triggering send/production workflows.
- Read deterministic server-derived revision diff facts fetched server-side.
- Summarize audit counts/latest safe action labels.
- Ask for missing measurements or selected revision context.

Denied:

- Browser-supplied company, role, user, tenant, cost snapshot, document facts, diff entries, approval state, or quote status as authority.
- Quote send, quote-sent transition, real provider delivery, real provider webhook consumption, provider acknowledgement assertion, delivery-attempt recording from chat, send-intent preparation from chat, delivery-outbox preparation from chat, artifact generation from chat, approval-token consumption from chat, quote status approval from chat, official PDF generation from chat, production package, create, update, delete, or other mutation-like requests.
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
- PDF generation for official quote or production artifacts from chat or an LLM-controlled tool.
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
| `get_quote_artifact_status` | Read/query | Requires authenticated session context, backend-resolved tenant scope, approved quote/document binding where applicable, and output filtering. It may report stored/deferred HTML/PDF artifact status, hash/version labels, and safe access model, but must not return raw HTML/PDF bytes, storage bucket/path, signed URLs, storage credentials, or provider details. |
| `explain_quote_artifact_status` | Read/conversation | May summarize controlled artifact status metadata. It must not return raw artifact bytes, storage locators, signed URLs, token material, generate artifacts, generate PDFs, or convert metadata into external delivery authority. |
| `explain_quote_artifact` | Read/conversation | Compatibility alias for read-only artifact explanation. It must follow the same constraints as `explain_quote_artifact_status`. |
| `get_pdf_artifact_status` | Read/query | Requires authenticated session context, backend-resolved tenant scope, approved quote/document binding, stored HTML source artifact binding, stored PDF artifact binding where present, and output filtering. It may report deterministic PDF artifact presence, renderer/version labels, hash binding, and access model, but must not return PDF bytes, storage bucket/path, signed URLs, provider details, or delivery authority. |
| `explain_pdf_artifact_status` | Read/conversation | May summarize trusted PDF artifact status. It must not generate PDFs, infer totals, expose storage internals, initiate delivery, mark quotes sent, or treat document/tool text as policy. |
| `get_approval_status` | Read/query | Requires authenticated session context, backend-resolved tenant scope, target revision validation, and sanitized output filtering. It may report pending/consumed/expired status and bound-safe flags, but must not return token hashes or consume approval tokens. |
| `explain_approval_status` | Read/conversation | May summarize sanitized approval status and deferred actions. It must not approve, send, change quote status, consume tokens, or treat approval text/tool output as authority. |
| `consume_approval_token_from_chat` | Forbidden mutation | Registered only so policy drift is visible. Runtime agents cannot consume approval tokens; the P9 HTTP consumption endpoint is a server/RPC boundary and can approve only through the guarded token/version/document/snapshot RPC, never from chat. |
| `get_send_gate_status` | Read/query | Requires authenticated session context, backend-resolved tenant scope, target revision validation, approved revision status, approved approval gate status, frozen document binding, and output filtering. It must not send, expose email provider secrets, expose storage paths, or create PDF/production state. |
| `explain_send_gate_status` | Read/conversation | May summarize trusted send-gate facts and deferred actions. It must not send quotes, approve quotes, consume approval tokens, generate PDFs, create production packages, or treat customer/tool text as delivery authority. |
| `get_send_preparation_status` | Read/query | Requires authenticated session context, backend-resolved tenant scope, approved revision status, approved approval gate status, frozen document binding, stored artifact binding, and output filtering. It may report whether a send intent has been prepared, provider availability, and blockers. It must not perform external delivery, expose recipient email/provider secrets, mark quotes sent, or create production state. |
| `explain_send_preparation_status` | Read/conversation | May summarize trusted send-preparation facts. It must not prepare the send intent, send quotes, approve quotes, generate PDFs, create production packages, or treat customer/tool text as delivery authority. |
| `get_delivery_status` | Read/query | Requires authenticated session context, backend-resolved tenant scope, approved revision, safe send-intent binding, stored PDF artifact binding, and output filtering. In P11 it may report provider-deferred outbox state and disabled provider adapter status. It must not expose recipient email, provider message IDs, provider responses, delivery tokens, webhook secrets, or send-state authority. |
| `explain_delivery_status` | Read/conversation | May summarize trusted provider-deferred outbox facts. It must not send quotes, mark delivery attempted, mark quotes sent, set provider message IDs, expose provider internals, or create production packages. |
| `get_provider_status` | Read/query | Requires authenticated session context, backend-resolved tenant scope, target revision validation, and sanitized server-owned provider configuration boundary state. It may report configured/missing booleans, disabled adapter labels, and blocked reasons only. It must not expose provider secrets, hostnames, usernames, credentials, raw provider payloads, provider message IDs, recipients, or sent authority. |
| `explain_provider_status` | Read/conversation | May summarize why the current provider boundary is missing or unverified. It must not ask for secrets, echo env values, configure providers, call providers, mark quotes sent, or treat provider-configured as provider-verified. |
| `get_provider_configuration_status` | Read/query | Compatibility alias for sanitized provider configuration status. It may report provider mode, configured/valid booleans, adapter/config version labels, and blocked/deferred reasons only. It must not return env names with values, hostnames, usernames, credentials, raw provider payloads, webhook signatures, provider message IDs, recipient data, or send authority. |
| `explain_provider_configuration_status` | Read/conversation | May explain server-fetched provider configuration readiness and why real delivery remains disabled. It must not request provider secrets from the user, infer provider details from prompts, activate a provider, call an external provider, or mark a quote sent. |
| `get_delivery_attempt_status` | Read/query | Requires authenticated session context, backend-resolved tenant scope, target revision validation, prepared delivery outbox state, and sanitized delivery-attempt ledger output. It may report blocked attempt status, version labels, idempotency status, and safe deferred actions only. It must not return sent timestamps, provider message IDs, raw provider responses, recipients, webhook secrets, storage paths, or acknowledgement authority. |
| `explain_delivery_attempt_status` | Read/conversation | May summarize trusted delivery-attempt facts and blockers. It must not record attempts, fake acknowledgements, mark sent, retry delivery, call webhooks, or create production packages. |
| `get_webhook_readiness` | Read/query | Requires authenticated session context, backend-resolved tenant scope, target revision validation, provider status resolution, and sanitized latest sandbox acknowledgement facts. It may report webhook configured/enabled booleans, signature-readiness booleans, sandbox acknowledgement status, and real sent blocked reason. It must not consume webhooks, return webhook secrets/signatures, store raw payloads, expose provider event IDs, or assert real acknowledgement. |
| `explain_webhook_readiness` | Read/conversation | May explain why real webhook consumption is unavailable or deferred based on trusted readiness fields. It must not process webhook bodies, verify browser-supplied signatures, ask for webhook secrets, treat sandbox acknowledgement as real acknowledgement, or mark quotes sent. |
| `explain_real_delivery_status` | Read/conversation | May summarize trusted provider, delivery-attempt, sandbox acknowledgement, webhook-readiness, and send-gate facts. It must keep real email sent, real acknowledgement, quote sent, and production package false unless a future verified backend command changes them. |
| `explain_why_real_sent_is_deferred` | Read/conversation | May explain the exact blockers for the approved-to-sent transition. It must not satisfy blockers from prompt text, browser payloads, tool-output instructions, sandbox acknowledgement, or user claims. |
| `explain_sandbox_vs_real_delivery` | Read/conversation | May distinguish sandbox delivery verification from real provider delivery and real acknowledgement verification. It must not let sandbox acknowledgement trigger real sent state or production package creation. |
| `explain_why_quote_is_not_sent` | Read/conversation | May summarize trusted send-gate/provider/attempt facts that explain why a quote is not sent. It must keep provider acknowledgement, external delivery, sent state, and production state false unless a future verified backend command says otherwise. |
| `record_delivery_attempt_from_chat` | Forbidden mutation | Registered only so policy drift is visible. Runtime agents cannot record delivery attempts; the HTTP delivery-attempt route is an audited server/RPC boundary and currently records only blocked provider-missing attempts. |
| `mark_quote_sent_from_chat` | Forbidden mutation | Registered only so policy drift is visible. Runtime agents cannot mark quotes sent, set sent timestamps, assert provider acknowledgements, or consume provider webhooks. |
| `acknowledge_delivery_from_chat` | Forbidden mutation | Registered only so policy drift is visible. Runtime agents cannot assert sandbox or real delivery acknowledgement, submit webhook bodies, replay acknowledgements, verify signatures, or create real sent state. |
| `send_quote_from_chat` | Forbidden mutation | Registered only so policy drift is visible. Runtime agents cannot send quotes or mark quotes sent. |
| `generate_pdf_from_chat` | Forbidden mutation | Registered only so policy drift is visible. Runtime agents cannot generate official PDFs. |
| `generate_artifact_from_chat` | Forbidden mutation | Registered only so policy drift is visible. Runtime agents cannot store or generate quote artifacts. |
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

- This document is preparation guidance plus the P14 read-only web chat boundary.
- Durable idempotency is implemented for the current Supabase-backed customer/project/quote-draft POST routes, configuration-draft POST/PATCH routes, deterministic snapshot calculation route, frozen document route, revision fork route, approval-gate preparation route, artifact-storage route, PDF-artifact route, send-intent preparation route, provider-deferred delivery-outbox route, blocked delivery-attempt route, and sandbox acknowledgement route. P14 also binds idempotency request hashes to the target resource so same body/key replays cannot cross revision or attempt targets. Runtime agent mutation tools are still deferred until the gateway enforces the same boundary.
- Policy tests cover forbidden tools, viewer mutation denial, tenant/session requirements, target-bound mutation idempotency metadata, approval/send-gate/artifact/PDF/send-preparation/delivery/provider/delivery-attempt/sandbox-acknowledgement/webhook-readiness metadata, prompt-injection denial, non-executable mutation/workflow policies, quote snapshot/document/diff policy metadata, sanitized prompt labels, and the static policy manifest endpoint. The manifest is `phase14-tool-gateway-read-only-v1`.
- Web session smoke covers unauthenticated chat blocking, read-only session-scoped chat success, server-fetched snapshot/document/artifact/PDF/approval/send-gate/delivery/provider/delivery-attempt/sandbox-acknowledgement/webhook-readiness/diff availability and missing-state explanations, prompt-injection blocking before reads, mutation/PDF-generation/artifact/send/delivery/provider-ack/webhook-consumption/mark-sent/approve/token-consume/calculation denial, forbidden field filtering, and no agent-side calculation.
- Unsafe runtime agent execution is not activated beyond the existing deterministic rules-mode adapters and read-only Supabase web route.
- Phase 7 session smoke verifies that primary and second tenant selector IDs cannot cross the agent route.
- Future implementation must keep gateway policy server-side and must add tests for tenant isolation, role denial, approval-token consumption denial/replay/stale binding, idempotency replay, prompt injection, malicious tool output, and deterministic-domain calculation ownership.
- Phase 12 tests now cover malicious prompt-injection wording for provider acknowledgement, webhook success, sent timestamps, and mark-sent attempts; explicit forbidden chat-side approval-consumption/approval/send/delivery/artifact/PDF/calculation/provider-ack/mark-sent tools; read-only artifact/PDF/send-preparation/delivery/provider/delivery-attempt explanations; and no model-side cost, delivery, or quote mutation authority.

## P13 Sandbox Delivery Tool Boundary

Implemented/prepared read-only tools:

- `get_delivery_acknowledgement_status`
- `explain_delivery_acknowledgement_status`
- `explain_sandbox_provider_status`
- `explain_delivery_retry_status`
- `explain_why_quote_is_or_is_not_sent`

These tools may explain only persisted, server-fetched sandbox provider, delivery-attempt, acknowledgement, retry/replay, send-gate, and not-sent facts. They must not expose acknowledgement hashes, raw payloads, provider internals, storage paths, signed URLs, token material, recipient values, service credentials, database URLs, or internal repository details.

Still forbidden/deferred:

- `send_quote_from_chat`
- `mark_quote_sent_from_chat`
- `acknowledge_delivery_from_chat`
- `record_delivery_attempt_from_chat`
- `approve_quote_from_chat`
- `consume_approval_token_from_chat`
- `generate_pdf_from_chat`
- `generate_artifact_from_chat`
- `generate_production_package`
- `mutate_quote_from_chat`
- `calculate_authoritative_totals_from_chat`

P13 session and compute tests cover malicious prompts asking the assistant to fake sandbox acknowledgement, replay acknowledgement, mark a quote sent, assert provider acknowledgement, bypass policy, call webhook-like actions, or calculate/send from chat. The accepted behavior is explanation or denial only.

## P14 Real Provider And Webhook Readiness Boundary

Implemented/prepared read-only tools:

- `get_provider_configuration_status`
- `explain_provider_configuration_status`
- `get_webhook_readiness`
- `explain_webhook_readiness`
- `explain_real_delivery_status`
- `explain_why_real_sent_is_deferred`
- `explain_sandbox_vs_real_delivery`

These tools may explain only server-fetched provider mode/config booleans, webhook readiness booleans, sandbox acknowledgement status, real acknowledgement disabled state, and real sent blockers. They must not expose provider secrets, env values, hostnames, usernames, credentials, webhook secrets/signatures, provider event identifiers, raw provider payloads, raw provider responses, recipient data, storage paths, signed URLs, token material, database URLs, or internal repository details.

Still forbidden/deferred:

- `send_quote_from_chat`
- `mark_quote_sent_from_chat`
- `acknowledge_delivery_from_chat`
- `consume_provider_webhook_from_chat`
- `record_delivery_attempt_from_chat`
- `approve_quote_from_chat`
- `consume_approval_token_from_chat`
- `generate_pdf_from_chat`
- `generate_artifact_from_chat`
- `generate_production_package`
- `mutate_quote_from_chat`
- `calculate_authoritative_totals_from_chat`

P14 tests must prove prompt/tool-output attempts to force real provider acknowledgement, forge webhook signatures, replay provider events, supply provider message IDs, mark real sent, or reinterpret sandbox acknowledgement as real delivery are denied or answered with read-only explanations.
