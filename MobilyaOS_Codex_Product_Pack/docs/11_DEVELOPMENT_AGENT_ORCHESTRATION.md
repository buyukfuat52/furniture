# Development Agent Orchestration

## Purpose

This document defines how the parent Codex session coordinates the six project-scoped development agents. It prevents uncontrolled parallel editing, contract drift, duplicate work, and premature claims of completion.

The parent Codex session is the **delivery orchestrator**. Specialized agents do not coordinate directly with one another and do not independently redefine the plan. Every assignment, handoff, contract change, conflict resolution, and quality-gate decision flows through the parent.

Machine-readable policy lives in:

- `.codex/orchestration/workflow.yaml`
- `.codex/orchestration/file-ownership.yaml`
- `.codex/orchestration/handoff.schema.json`

## Operating principles

1. **Plan before fan-out.** Do not start all implementation agents against an unfrozen architecture.
2. **One owner per artifact.** An agent edits only assigned paths. Shared files are parent-owned unless a temporary lease is granted.
3. **Contracts before consumers.** Domain, API, event, tool, and schema contracts are frozen before dependent implementations fan out.
4. **Parallelize independent work only.** Backend, frontend, and AI implementation may run concurrently only after their interfaces are explicit.
5. **Reviewers stay independent.** Security is read-only. QA owns tests and verification evidence, not production behavior.
6. **No direct agent-to-agent assumptions.** Agents return structured handoffs to the parent; the parent routes approved follow-up instructions.
7. **Stop on contract drift.** A discovered contract change pauses affected dependents until the parent approves and republishes the contract.
8. **Evidence over confidence.** A gate passes only with commands, test results, artifacts, or concrete code references.
9. **Deterministic correctness wins.** Domain invariants, tenant isolation, money precision, and revision immutability override speed and UI polish.
10. **Bounded retries.** Failed tasks may be retried after the failure mode is changed; repeated identical attempts are prohibited.

## Agent states

Each worker is always in exactly one state:

- `idle`: no assignment; must not edit files.
- `reconnaissance`: read-only discovery and evidence gathering.
- `lead`: owns the phase result for its specialty.
- `implement`: edits only assigned paths and produces tests.
- `review`: inspects another agent's output without broad refactoring.
- `fix`: resolves explicitly assigned findings in owned paths.
- `blocked`: cannot proceed until a named dependency is supplied.
- `done`: assignment completed and handoff returned.

An agent with no explicit current-phase assignment must remain `idle` or perform a bounded read-only reconnaissance task requested by the parent.

## Phase model

### P0 — Bootstrap and repository survey

**Lead:** parent Codex session

**Parent actions:**

- Read repository instructions and product documents.
- Inspect repository, toolchain, versions, and available services.
- Create `docs/implementation/STATUS.md` and a run directory under `docs/implementation/agent-runs/<run_id>/`.
- Resolve whether the repository is greenfield or incremental.
- Assign path ownership and initial tasks.

**Worker behavior:**

- All workers remain idle unless the parent requests a short read-only reconnaissance.
- No implementation files are created by workers in P0.

**Exit gate G0:** repository state, toolchain, known blockers, run ID, and ownership plan are recorded.

### P1 — Discovery, invariants, threat model, and acceptance plan

**Lead:** `domain_architect`

**Parallel workers:**

- `security_reviewer`: creates the initial threat model and abuse cases.
- `qa_reviewer`: creates the acceptance map, golden cases, and test strategy.

**Reconnaissance only:**

- `backend_engineer`: identifies framework, persistence, migration, and integration constraints; no production edits.
- `frontend_engineer`: identifies UX routes, data dependencies, and reusable UI constraints; no production edits.
- `ai_prompt_engineer`: maps prompt, tool, model, and approval boundaries; no production edits.

**Required outputs:**

- Bounded contexts and aggregate boundaries.
- Invariants, formulas, provenance requirements, transaction boundaries.
- Draft data model, API/event/tool contract inventory.
- Threat model with critical trust boundaries.
- Acceptance matrix mapped to executable test types.
- Ambiguities and explicit assumptions.

**Exit gate G1 — Contract readiness:**

- Parent resolves disagreements.
- Critical domain ambiguities are removed or recorded as ADRs.
- Tenant, money, revision, BOM, edge-band, nesting, labor, and costing rules are testable.
- No implementation fan-out begins before G1 passes.

### P2 — Contract skeleton and executable foundations

**Lead:** `backend_engineer` for executable contracts; parent owns shared contract files.

**Parallel assignments:**

- `backend_engineer`: domain value objects, package skeleton, migrations, auth/tenant foundations, OpenAPI/event/tool gateway contracts, health endpoints.
- `frontend_engineer`: design system shell, routes, typed API boundary, form/error primitives, mock adapters generated from frozen contracts. It must not invent API fields.
- `ai_prompt_engineer`: prompt registry loader, structured-output types, model interface, deterministic fake model, tool schema loader. It must not call unfinished production tools.
- `qa_reviewer`: contract/schema tests, golden-test fixtures, test harness, CI verification skeleton.
- `domain_architect`: reviews implemented contracts and answers bounded clarification requests; does not redesign unrelated scope.
- `security_reviewer`: reviews auth, tenant, upload, tool, and approval contracts; read-only.

**Exit gate G2 — Executable contract gate:**

- Repository boots.
- Migrations apply to a clean database.
- API/tool/schema contracts validate.
- Type generation or equivalent typed boundaries compile.
- Fake adapters allow frontend and AI tests without paid services.
- Critical/high contract-level security findings are fixed.

### P3 — Vertical-slice implementation

**Parallel leads with exclusive path ownership:**

- `backend_engineer`: core domain and application behavior, persistence, events, documents, deterministic calculations.
- `frontend_engineer`: complete Turkish user flow against real APIs or contract-faithful local adapters.
- `ai_prompt_engineer`: runtime agent orchestration, authorization-aware tool calls, prompt evals, fake/local model operation.

**Concurrent support:**

- `domain_architect`: reviews new domain decisions and golden examples; raises contract-change requests rather than editing other owners' code.
- `qa_reviewer`: writes and runs unit, integration, contract, and E2E tests in owned test paths; reports failures with reproduction.
- `security_reviewer`: performs incremental review of completed slices; no implementation edits.

**Integration order inside the phase:**

1. Identity, company, RBAC, and catalog.
2. Project and draft revision.
3. Product template and configuration validation.
4. BOM, four-edge banding, hardware, operations, unit labor.
5. Nesting and cost snapshot.
6. Pricing and proforma generation.
7. Approval, immutable revision, fork, semantic diff.
8. Authorized agent chat and draft actions.

A later slice may not claim completion while an earlier dependency remains a stub.

**Exit gate G3 — Runnable slice gate:**

- The seeded flow works through API and UI.
- Authoritative calculations use deterministic services.
- Tests cover the main happy path and mandatory negative cases.
- No hardcoded UI totals or fake success states remain in the critical path.

### P4 — Integration, adversarial review, and repair

**Leads:** `qa_reviewer` and `security_reviewer`

**QA responsibilities:**

- Run the full acceptance matrix.
- Reproduce integration failures and classify root ownership.
- Validate build reproducibility, migrations, seed data, PDF, diff, and E2E.

**Security responsibilities:**

- Test tenant isolation, role escalation, approval bypass, injection, prompt injection, file handling, secrets, SSRF/path traversal, session controls, and tool authorization.
- Return severity-ranked findings with reproduction and remediation criteria.

**Implementer behavior:**

- `backend_engineer`, `frontend_engineer`, and `ai_prompt_engineer` remain idle until the parent assigns a specific fix request.
- Fixes must be minimal, remain within owned paths, and include regression tests.
- `domain_architect` verifies that repairs do not violate domain invariants.

**Exit gate G4 — Hardening gate:**

- All critical and high findings are resolved and re-tested.
- Medium/low findings are documented with rationale and owner.
- Cross-tenant, immutable-revision, money, idempotency, prompt-injection, and approval tests pass.

### P5 — Release verification and handover

**Lead:** parent Codex session

**QA:** runs `make verify` from a clean state and records exact evidence.

**Security:** confirms closure of critical/high findings and signs off remaining risk record.

**Domain architect:** confirms golden-domain evidence and invariants.

**Implementers:** fix only release-blocking failures explicitly assigned by the parent.

**Exit gate G5 — Done:**

- Definition of Done is satisfied.
- `docs/implementation/STATUS.md` contains exact commands and results.
- Run instructions, demo credentials, architecture decisions, and known limitations are documented.
- The parent reports only checks that were actually executed.

## Coordination while another agent is working

The parent uses the following rule:

- If work shares a mutable contract or file, run it **sequentially**.
- If work consumes a frozen contract and has disjoint paths, run it **in parallel**.
- If an agent is waiting on another, assign it bounded reconnaissance, tests, fixtures, documentation, or review that cannot invalidate the active owner's work.
- Never keep an agent editing speculative consumers while its provider contract is changing.

Examples:

- While backend defines OpenAPI in P2, frontend may build the layout and contract-generated client boundary, but it may not invent response fields.
- While backend implements costing, QA may prepare golden fixtures from approved domain examples; frontend may build a breakdown component against the frozen cost schema.
- While frontend implements revision diff, security may review authorization on diff endpoints, and QA may author E2E cases. Backend changes to the diff schema require a contract-change handoff before consumers continue.
- While security reviews, implementers wait for routed findings rather than pre-emptively changing unrelated code.

## File ownership and shared-file locking

Default ownership is defined in `.codex/orchestration/file-ownership.yaml`.

Rules:

1. The parent owns shared files such as root configuration, lockfiles, `Makefile`, Compose, OpenAPI/AsyncAPI master contracts, and cross-service ADRs.
2. A worker may edit a shared file only after the parent grants a lease naming the exact path and purpose.
3. A lease ends when the worker returns its handoff.
4. If two agents need the same path, the parent serializes their work.
5. Reviewers never silently repair production files.

## Contract-change protocol

When an agent discovers that a frozen contract must change:

1. Stop dependent edits.
2. Return a `contract_change` handoff containing reason, affected artifacts, compatibility impact, migration impact, tests, and alternatives.
3. Parent asks `domain_architect` when domain behavior changes, `security_reviewer` when trust or authorization changes, and `qa_reviewer` when acceptance behavior changes.
4. Parent approves, rejects, or narrows the change and records an ADR when material.
5. Contract owner updates the contract first.
6. Parent routes follow-up assignments to consumers.

No agent may implement an unapproved breaking contract change and ask consumers to catch up later.

## Handoff protocol

Every agent result must be representable by `.codex/orchestration/handoff.schema.json` and include:

- run, phase, assignment, source, destination, type, and status;
- concise summary;
- files read and changed;
- contract changes or explicit `none`;
- decisions and assumptions;
- tests or commands actually run with results;
- blockers and residual risks;
- requested next action.

The parent stores material handoffs under:

`docs/implementation/agent-runs/<run_id>/handoffs/`

Agents must not claim tests passed when they were not executed.

## Failure and retry policy

- First failure: capture command, output, suspected cause, and owner.
- Retry only after changing code, configuration, fixture, dependency state, or hypothesis.
- After two failed attempts with the same failure class, return `blocked` to the parent.
- The parent may reassign a read-only explorer or reviewer before another implementation attempt.
- External credentials never block the local vertical slice; use an approved deterministic adapter.

## Decision authority

- Parent Codex session: final delivery, sequencing, shared files, conflict resolution, gate decisions.
- Domain architect: domain invariants and calculation semantics; parent records final ADR.
- Backend engineer: implementation details inside core service boundaries.
- Frontend engineer: interaction and presentation details inside frozen contracts.
- AI prompt engineer: prompt/tool/model implementation inside authorization and domain constraints.
- Security reviewer: severity and evidence; parent assigns remediation.
- QA reviewer: acceptance evidence and release verification; parent decides final completion only when evidence exists.
