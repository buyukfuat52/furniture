# Target Architecture

## Shape
A monorepo with three deployable processes and shared contracts:

- `apps/web`: Next.js TypeScript web application.
- `services/core`: Go modular monolith and API.
- `services/compute`: Python FastAPI computational and agent-support service.
- `packages/contracts`: OpenAPI, AsyncAPI, JSON Schema and generated clients.
- `infra`: Docker Compose, migrations, observability and local dependencies.

## Core backend bounded contexts
- identity and access
- companies and users
- catalog
- supplier pricing
- customers and projects
- product templates and variants
- design/BOM
- nesting
- costing and pricing
- quotes and documents
- revisions and diff
- workflow and approvals
- audit and search

## Layering
`domain -> application -> ports -> adapters -> transport`

Domain packages cannot import HTTP, SQL, NATS, S3, Temporal or model SDKs.

## Persistence
- PostgreSQL: source of truth.
- Object storage: PDFs, SVG/DXF placeholders, imports and artifacts.
- NATS JetStream: durable event distribution.
- Transactional outbox in PostgreSQL.
- Optional pgvector only for permitted searchable text, always tenant-filtered.

## Synchronous versus asynchronous
Synchronous:
- form validation
- catalog reads
- quote editing
- deterministic calculation requests that complete quickly

Asynchronous/workflow:
- imports
- supplier RFQ lifecycle
- large nesting jobs
- PDF/production package generation
- approval waits
- customer delivery
- revision regeneration

## Events
Use CloudEvents-compatible envelope and versioned names. Events are facts and immutable. Commands are directed and idempotent. Queries have no side effects.

## AI boundary
The model receives only task-minimum data and can call authorized application tools. It has no direct database access. Tool responses contain authoritative values and provenance. The agent layer records prompt version, model/provider, tool calls, approvals and trace IDs.

## Local development
Docker Compose should provide PostgreSQL, NATS, MinIO and optionally Temporal. The product must still support a reduced local workflow adapter if Temporal is disabled.
