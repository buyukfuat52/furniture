# Scope and Vertical Slice

## In scope for the first production-oriented slice
- Multi-tenant identity and RBAC
- Customer, supplier, material/hardware/edge-band/labor catalog
- Historical price observations and CSV import
- Projects and immutable quote revisions
- Data-driven product templates
- Complete support for wardrobe and kitchen base-cabinet examples
- Deterministic product variant, BOM, edge-band, hardware and labor calculation
- 2D rectangular sheet nesting with practical manufacturing constraints
- Cost snapshot, markup/margin, discount, VAT, rounding
- Quote/proforma PDF
- Revision fork and semantic diff
- Audit timeline
- Controlled agent chat over application tools
- Docker local environment, seed data, tests and CI

## Deliberately deferred
- Direct CNC machine control
- Proprietary post-processors for every brand
- Full accounting and e-invoice implementation
- Unsupervised supplier portal automation
- Production CAD from arbitrary photos
- Full warehouse, payroll, accounting and capacity planning
- Advanced 3D photorealistic rendering

## Quality bar
The slice is accepted only if the primary flow works through the UI and API using real deterministic calculations, persists to PostgreSQL, creates a PDF, supports revision comparison, and passes tenant/security tests.
