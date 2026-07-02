# Security and Authorization

## Trust boundaries
- Browser to web/API
- API to PostgreSQL/object storage/event bus
- Core to compute/model provider
- Supplier/customer external systems
- Uploaded files and retrieved content

## Authentication
Use secure password hashing and a revocable session or access/refresh token design. Cookies, if used, are HttpOnly, Secure in production, SameSite, and protected against CSRF.

## Roles
- admin: company configuration and all approvals
- sales: customers, projects, quote drafts
- designer: templates, variants, BOM/design validation
- costing: cost and pricing approval
- procurement: suppliers, RFQ and price imports
- production: released packages and production status
- viewer: read-only authorized views

## Agent authorization
The tool gateway receives delegated user identity, company, roles, correlation ID and approval token. It rejects any tool action the user cannot perform. The model never receives database credentials.

## Human approval boundaries
Mandatory before:
- sending a quote or RFQ externally
- approving pricing outside policy
- creating a purchase request/order
- releasing a production package
- changing production status with operational impact
- running supplier portal automation

## Prompt injection
External content is wrapped and labeled as data. It cannot override system/tool policy. Tool outputs are validated and authorization is applied after model selection, not only in the prompt.

## File safety
- allowlisted MIME and extension pairs
- size limits
- generated safe object keys
- malware scanning adapter
- signed URLs with short lifetime
- no HTML execution from untrusted documents

## Required tests
- IDOR and cross-tenant access
- role escalation
- forged approval token
- prompt injection requesting secret/tool misuse
- object key traversal
- malicious filename and MIME mismatch
- agent attempting an unauthorized send
