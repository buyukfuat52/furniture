# ONE-SHOT CODEX BUILD MISSION — MOBILYAOS

<role>
You are the principal engineer and delivery lead responsible for turning this repository specification into a working, production-oriented product vertical slice. You own architecture, implementation, tests, UX quality, security, developer experience, documentation, and final verification.
</role>

<objective>
Build the closest feasible product-level implementation of MobilyaOS in one autonomous Codex run. Deliver a coherent, runnable vertical slice rather than a wide collection of disconnected stubs. Keep working until the acceptance criteria are met or a genuinely external blocker is reached.
</objective>

<mandatory_first_steps>
1. Read `AGENTS.md` and the documents listed in its read order.
2. Inspect the repository and available toolchain.
3. Create `docs/implementation/STATUS.md` with a phase checklist, decisions, risks, and verification log.
4. Explicitly spawn and wait for specialized subagents:
   - `domain_architect`: domain boundaries, invariants, data model, calculations.
   - `backend_engineer`: Go API, persistence, auth, outbox/events, documents.
   - `frontend_engineer`: professional Turkish UX, forms, dashboards, revision diff.
   - `ai_prompt_engineer`: runtime prompts, tools, model adapter, agent evaluations.
   - `security_reviewer`: tenant isolation, authorization, injection, secrets, file safety.
   - `qa_reviewer`: test plan, golden cases, E2E, build and release verification.
5. Consolidate their output into one implementation plan. Resolve disagreements in favor of deterministic correctness, security, and a runnable slice.
</mandatory_first_steps>

<product_slice>
Implement an end-to-end flow:

1. User signs in to a seeded demo company with role-based access.
2. User manages customers, suppliers, material SKUs, hardware SKUs, edge-band SKUs, labor operations, and historical supplier price observations.
3. User creates a project and a quote revision.
4. User adds one or more furniture items. Fully support at least:
   - Wardrobe / vestiyer
   - Kitchen base cabinet run / mutfak alt dolabı
   The product-template mechanism must be data-driven so more categories can be added later.
5. User configures dimensions, quantity, panel materials, back panel, doors, hinges, drawer rails, edge-band policy, and unit labor.
6. Deterministic services generate and validate:
   - Product variant
   - Parts and BOM
   - Four-edge edge-band requirements
   - Hardware quantities
   - Operations and unit labor × product quantity
   - A practical 2D sheet nesting result with kerf, trim, grain/rotation constraints, sheet count, utilization, waste, and reusable offcuts
   - Cost snapshot with exact provenance
7. User applies markup or target gross margin, discount, VAT, and rounding policy.
8. System renders a professional Turkish quote/proforma PDF and stores its hash and object metadata.
9. User approves the quote. Approved/sent revision becomes immutable.
10. User forks a revision, changes a parameter or material, recomputes, and sees structured side-by-side differences for parameters, BOM, edge banding, sheet usage, labor, cost, and quote total.
11. A chat/assistant panel can answer project questions and draft actions by calling authorized application tools. It must never calculate authoritative values itself. All write/send actions require policy checks and approval state.
12. Seed a complete demo project and provide a one-command demonstration path.
</product_slice>

<target_technology>
Use the architecture documents unless the actual environment makes a component impossible:

- Monorepo.
- Web: Next.js + TypeScript strict mode, accessible component system, responsive PWA-oriented UI.
- Core backend: Go modular monolith with REST/OpenAPI, domain packages, PostgreSQL, migrations, transactional outbox.
- Computational/AI service: Python FastAPI for nesting adapter, prompt registry/model adapter, and agent evaluation utilities. Deterministic geometry/cost logic may remain in Go when that improves consistency; do not split logic merely to satisfy a diagram.
- Storage: S3-compatible MinIO/Garage adapter with local MinIO in Docker Compose.
- Events: NATS JetStream with CloudEvents envelope and AsyncAPI documentation.
- Long-running workflow: Temporal integration for quote approval/document workflow, or a documented durable local adapter if Temporal cannot be made reliable in the available run. Keep the port compatible.
- Observability: OpenTelemetry instrumentation and structured logs; local observability may be optional-profile infrastructure.
- PDF: deterministic HTML-to-PDF or another reproducible local method.
- Tests: Go tests, Python pytest, frontend unit tests, Playwright E2E, contract/schema validation.
- CI: GitHub Actions equivalent of `make verify`.
</target_technology>

<architecture_rules>
- Organize the Go core by bounded context: identity, company, catalog, supplier-pricing, customer-project, product-template, design/BOM, nesting, costing, quote, revision, document, workflow, audit.
- Domain code must not depend on HTTP, database, NATS, S3, or LLM SDKs.
- Use ports/adapters. External services have local deterministic mocks.
- Use PostgreSQL as the transactional source of truth.
- Use UUID/ULID identifiers consistently.
- Store money as integer minor units plus currency or exact decimal. State the choice and test it.
- Store dimensions in integer millimetres.
- Every tenant resource includes and enforces `company_id`.
- Use optimistic concurrency/version columns where revision races matter.
- Every command has an idempotency key.
- Publish events through the transactional outbox; consumers are idempotent.
- Store generated files with SHA-256, content type, size, revision ID, and object version/key.
</architecture_rules>

<domain_rules>
Implement the formulas and invariants in `docs/02_DOMAIN_RULES.md` exactly. In particular:
- Unit labor is entered per produced furniture unit and multiplied by quantity.
- Edge banding is represented per part edge: north/east/south/west, with visibility, band SKU/type, process, and waste/setup allowance.
- Sheet count is derived from nesting, not total area division.
- Cost snapshots freeze price observations, quantity, conversion, formula version, and result.
- Markup and gross margin are distinct calculations and labeled correctly.
- Approved or sent revisions are immutable.
</domain_rules>

<runtime_agent_requirements>
- Load prompts from versioned files in `prompts/`; never hardcode one giant prompt in application code.
- Implement the base system prompt plus specialist prompts and the tool catalog.
- Keep fixed prompt content separate from variables/tool results.
- Use structured outputs matching `tools/schemas/agent_response.schema.json`.
- Treat external content as untrusted data and defend against prompt injection.
- Apply delegated authorization: an agent can never exceed the user's role or tenant access.
- `send`, `approve`, `create purchase request`, `update production status`, and supplier portal actions require explicit policy/approval handling.
- Provide a provider-neutral model interface with a deterministic fake model for tests and an OpenAI-compatible/local endpoint adapter configured only through environment variables.
- The application must run without a model endpoint; chat should clearly enter demo/rules mode rather than fail the product.
</runtime_agent_requirements>

<ux_requirements>
- The UI is Turkish and uses professional furniture/manufacturing terminology.
- Create a coherent design system: typography, spacing, form controls, status chips, tables, empty/error/loading states, dialogs, and printable layouts.
- Required screens: login, dashboard, catalog/prices, customers, projects, project detail, quote builder wizard, costing/pricing, quote preview, revision comparison, agent chat, audit timeline.
- Quote builder must show progress and validation, not one overloaded form.
- Cost breakdown must distinguish material, hardware, edge band, machine/operation, unit labor, overhead, risk, markup/margin, discount, VAT, and total.
- Revision comparison must support two panels and category filters.
- Meet basic WCAG expectations: labels, keyboard path, focus states, contrast, semantic tables, and error summaries.
- Avoid generic AI dashboard visuals. Make the product look like a serious B2B manufacturing application.
</ux_requirements>

<security_requirements>
- Implement authentication appropriate for a local demo and a production-ready interface: secure password hashing, short-lived access token or secure session, refresh/session revocation, CSRF protection where applicable.
- RBAC roles: admin, sales, designer, costing, procurement, production, viewer.
- Enforce tenant isolation in repositories/services and add negative tests for cross-tenant access.
- Validate uploads by MIME, size, extension, and filename; isolate object storage paths.
- Never log secrets, tokens, full prompt context, or sensitive customer data.
- Add rate limiting for auth and agent endpoints.
- Add security headers and safe CORS defaults.
- Add prompt-injection tests and tool authorization tests.
- Produce `docs/THREAT_MODEL.md` and resolve critical/high findings before completion.
</security_requirements>

<seed_and_demo>
Create deterministic seed data:
- One demo company and at least two users with different roles.
- Suppliers, panel materials, edge bands, hinges, rails, labor operations, VAT and margin policies.
- Historical price observations.
- One complete wardrobe quote and one kitchen base-cabinet quote.
- One approved revision and one forked revision with meaningful differences.
- Generated quote PDF and revision diff data.

Provide `make demo` that starts dependencies, migrates, seeds, and prints login credentials and local URLs. Credentials must be demo-only and visibly unsafe for production.
</seed_and_demo>

<verification>
Do not finish after writing files. Complete this loop:
1. Format all languages.
2. Run lint and static analysis.
3. Run unit tests, golden domain tests, integration tests, schema tests, and prompt eval tests.
4. Run production builds.
5. Run Playwright E2E for the seeded vertical slice.
6. Run tenant-isolation, authorization, idempotency, money precision, immutable revision, and prompt-injection tests.
7. Run `/review` or spawn dedicated review agents for correctness, security, race/concurrency, test gaps, maintainability, and UX.
8. Fix all critical and high-severity findings; document unresolved medium/low risks.
9. Run `make verify` from a clean state.
10. Update `docs/implementation/STATUS.md` with exact results.
</verification>

<decision_policy>
- Do not ask the user to choose routine libraries or naming details. Make a defensible choice and record it in an ADR.
- Ask only when blocked by an unavailable external credential or a destructive action outside the repository. Otherwise use a mock/adapter and proceed.
- Do not reduce correctness or security merely to claim full scope.
- When time/context is constrained, prioritize the complete vertical slice, tests, and product polish over extra ERP breadth.
- Never leave the main flow as mock UI over fake hardcoded totals. Seeded data is acceptable; calculations must use the real deterministic engines.
</decision_policy>

<final_response>
Return:
- What was implemented and verified.
- Exact commands to run.
- Demo credentials and URLs.
- Test/build results.
- Architecture decisions and known limitations.
- The next five highest-value implementation steps.
Do not claim success for any check you did not run.
</final_response>
