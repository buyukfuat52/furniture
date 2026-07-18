# MobilyaOS Repository Instructions

## Mission
Build a production-oriented vertical slice of a furniture CPQ + deterministic manufacturing planning + project/revision + agentic operations platform. The repository must stay runnable, testable, secure by default, and understandable to a new engineer or coding agent.

## Read order before implementation
1. `docs/00_PRODUCT_VISION.md`
2. `docs/01_SCOPE_AND_VERTICAL_SLICE.md`
3. `docs/02_DOMAIN_RULES.md`
4. `docs/03_TARGET_ARCHITECTURE.md`
5. `docs/07_TEST_AND_ACCEPTANCE.md`
6. `docs/10_DEFINITION_OF_DONE.md`
7. `docs/11_DEVELOPMENT_AGENT_ORCHESTRATION.md`
8. `.codex/orchestration/workflow.yaml` and `.codex/orchestration/file-ownership.yaml`
9. `CODEX_ONE_SHOT_PROMPT.md` for the current build mission

Do not read every prompt file into context unless implementing the runtime agent layer. Use the prompt registry to route to the relevant files.

## Non-negotiable invariants
- LLMs never calculate authoritative dimensions, BOM quantities, sheet count, waste, edge-band consumption, inventory, labor cost, tax, margin, or totals.
- All authoritative numbers come from deterministic, versioned domain services and are stored with provenance.
- Sent or approved quote revisions are immutable. Changes create a new revision.
- Every tenant-owned row includes `company_id`; authorization must enforce tenant and role boundaries server-side.
- Destructive or externally visible actions require an explicit policy check and, where specified, human approval.
- Never place secrets, credentials, tokens, personal data, or supplier portal passwords in prompts, logs, fixtures, screenshots, or source control.
- Use integer minor currency units or a decimal library; never use binary float for money.
- Use millimetres as canonical geometry units.
- All commands and event handlers must be idempotent.
- Preserve auditability: actor, tenant, correlation ID, source revision, price observation, formula version, prompt version, and tool call.

## Delivery strategy
- Prefer a modular monolith for core business logic, with explicit domain packages and ports/adapters.
- Keep frontend, core backend, and computational/AI worker as independently runnable processes.
- Implement one complete vertical slice before expanding breadth.
- External providers must have interfaces plus deterministic mock adapters. The repository must run without paid API keys.
- Use migrations and seed data. No hidden manual database setup.

## Engineering standards
- TypeScript strict mode; no `any` except isolated, justified interop boundaries.
- Go code must pass `gofmt`, `go vet`, race-safe tests where relevant, and static checks.
- Python must be typed, formatted, linted, and tested.
- Validate all API inputs. Return RFC 7807-style structured errors or a documented equivalent.
- Use structured logging with `trace_id`, `correlation_id`, `company_id`, and `actor_id` where available.
- Public behavior requires tests. Domain calculations require table-driven golden tests.
- Avoid speculative abstractions and placeholder TODOs in the critical path.
- Do not claim an integration works unless a test or runnable demo proves it.

## Commands Codex must create and maintain
Provide a root `Makefile` (or equivalent cross-platform task runner) with at least:
- `make bootstrap`
- `make dev`
- `make test`
- `make lint`
- `make typecheck`
- `make verify`
- `make seed`
- `make demo`
- `make clean`

`make verify` must run formatting checks, lint, type checks, unit/integration tests, contract validation, prompt/schema validation, and a production build.

## Work protocol
1. Inspect current files and environment.
2. State a concise execution plan and record it in `docs/implementation/STATUS.md`.
3. Follow `docs/11_DEVELOPMENT_AGENT_ORCHESTRATION.md` and `.codex/orchestration/workflow.yaml`. Do not start all agents as uncontrolled writers.
4. Run the phase gates in order: P0 bootstrap, P1 contract discovery, P2 executable foundations, P3 vertical slice, P4 adversarial review/repair, P5 release verification.
5. Route all assignments and handoffs through the parent Codex session. Agents do not coordinate by private assumptions.
6. Enforce `.codex/orchestration/file-ownership.yaml`; shared files require a parent-issued lease and conflicting edits are serialized.
7. A frozen contract is required before independent consumers work in parallel. Breaking changes use the contract-change handoff protocol.
8. Work in thin, testable increments. Run relevant checks after each increment.
9. Before finishing, run full verification, review the diff, resolve all critical/high issues, and update documentation.
10. Report only verified functionality, known limitations, and exact run commands.

## Definition of done routing
The authoritative criteria are in `docs/10_DEFINITION_OF_DONE.md`. When requirements conflict, security and deterministic domain correctness override convenience or visual polish.
