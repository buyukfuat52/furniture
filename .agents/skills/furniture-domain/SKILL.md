---
name: furniture-domain
description: Use for furniture CPQ, product templates, BOM, panel parts, edge banding, labor, nesting, costing, quote revision, and production-package tasks. Do not use for generic infrastructure-only work.
---

# Furniture Domain Workflow

1. Read `docs/02_DOMAIN_RULES.md` and identify the exact invariant affected.
2. Represent dimensions in integer millimetres and money exactly.
3. Make authoritative results deterministic and versioned.
4. Add or update golden examples for wardrobe and kitchen base cabinet.
5. Preserve provenance from input parameter and price observation to final cost.
6. For revisions, fork rather than mutate approved/sent snapshots.
7. Verify edge banding per individual part edge.
8. Verify unit labor multiplication and separate setup labor.
9. Verify nesting placements do not overlap and obey stock/kerf/grain constraints.
10. Run relevant domain tests before reporting completion.
