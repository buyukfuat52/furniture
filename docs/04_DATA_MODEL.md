# Core Data Model

All tenant-owned entities contain `company_id`, timestamps, actor provenance where applicable, and optimistic version where concurrent edits are possible.

## Identity
- Company
- User
- Role
- UserRole
- Session / RefreshToken

## Commercial and catalog
- Customer
- Supplier
- MaterialSKU
- HardwareSKU
- EdgeBandSKU
- LaborOperation
- PriceObservation
- TaxPolicy
- PricingPolicy

## Product and manufacturing
- ProductTemplate
- ProductTemplateVersion
- ProductVariant
- ProductParameterValue
- Part
- PartEdge
- HardwareRequirement
- OperationRequirement
- BOMSnapshot
- NestingJob
- NestingSheet
- NestingPlacement
- Offcut

## Project and quote
- Project
- QuoteRevision
- QuoteItem
- CostSnapshot
- CostLine
- PricingSnapshot
- Approval
- GeneratedDocument
- ChangeReport
- ProductionPackage

## Workflow, events and audit
- OutboxEvent
- InboxConsumption
- WorkflowInstance
- ToolInvocation
- AgentRun
- AuditEntry

## Important constraints
- Unique revision number per project.
- Sent/approved revision update guard.
- Price observation append-only.
- Generated document hash unique per content.
- Idempotency keys unique within company and command type.
- Tenant key included in all relevant unique indexes.
- Foreign keys never cross companies; enforce in application and test with negative cases.
