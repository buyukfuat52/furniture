# Domain Rules and Deterministic Calculations

## Canonical units
- Geometry: integer millimetres.
- Area display: square metres derived from mm².
- Edge-band display: metres derived from mm.
- Money: integer minor units with ISO currency, or exact fixed-scale decimal. Never binary float.
- Percentages: basis points or exact decimal.

## Price observations
A material price is an append-only observation, not a mutable current-price cell.
Required provenance:
- supplier
- internal SKU and supplier SKU
- source type and source reference
- observed timestamp and validity interval
- currency, unit, pack size, tax inclusion
- minimum quantity and delivery notes
- raw source object hash where applicable

A cost snapshot stores the exact observation IDs and conversion factors used.

## Product variant and BOM
A product template defines parameter schema, constraints, formulas, part recipes, hardware rules, edge policies, and operation rules. Creating a variant:
1. Validates parameter types and allowed ranges.
2. Resolves dimensions in mm.
3. Produces stable part codes.
4. Produces parts, hardware, operations and edge requirements.
5. Rejects negative, impossible, overlapping or incompatible geometry.

LLMs may propose template drafts but cannot publish them without deterministic validation and human approval.

## Edge banding
Each rectangular part has four independent edges: north, east, south, west.
Each edge stores:
- visibility class: front-visible, side-visible, interior-visible, hidden, wall-contact
- band SKU/type and thickness
- process: straight, 45-degree mitre, groove/profile, none
- override reason and actor when deviating from policy

Consumption:
`base_length_mm = sum(edge_length_mm * part_quantity for all banded edges)`

`billable_length_mm = base_length_mm * (1 + waste_rate) + setup_allowance_mm`

Cost includes exact band material, adhesive/consumable policy, machine time, and labor operation where configured. The engine performs the calculation; the agent only explains the returned result.

## Unit labor
Labor is entered per produced furniture unit unless explicitly marked as batch/setup labor.

`unit_labor_total = sum(operation.unit_labor_minor * product_quantity)`

`batch_labor_total = sum(operation.batch_labor_minor * batch_count)`

The UI and documents must distinguish unit labor from setup/batch labor.

## Nesting and sheet waste
Final sheet count and waste must come from a placement solution, not total part area divided by sheet area.
Inputs include:
- sheet size and available stock/offcut
- part width, height, quantity
- grain direction
- whether 90-degree rotation is allowed
- kerf
- sheet trim margins
- grouping/lot constraints
- minimum reusable offcut dimensions

Outputs include:
- placements per sheet
- sheet count
- used area, kerf/trim loss, remaining waste
- utilization percentage
- reusable offcuts with dimensions
- solver/heuristic version and deterministic seed

The first implementation may use a tested deterministic heuristic, but the result must be reproducible and benchmarked.

## Costing
Cost categories:
- panels and sheets
- edge-band and consumables
- hardware/accessories
- operations and machine time
- unit labor and batch/setup labor
- outsourced work
- transport and installation
- overhead
- risk/contingency

A cost snapshot is immutable and includes formula version, price observation IDs, quantities, unit conversions, rounding steps, and category totals.

## Markup versus gross margin
- Markup pricing: `sell = cost * (1 + markup_rate)`
- Target gross margin pricing: `sell = cost / (1 - margin_rate)`

Never label one as the other. Reject margin rates greater than or equal to 100%.

## Quote total order
Recommended order:
1. Sum line selling prices before discount.
2. Apply allowed line/project discounts.
3. Apply rounding policy.
4. Calculate VAT by documented policy.
5. Produce grand total.

Every step uses exact money arithmetic and is golden-tested.

## Revision rules
- Draft revisions may change.
- Approved or sent revisions are immutable.
- A change forks a new revision with `parent_revision_id`.
- Revision snapshot includes parameters, selected SKUs, price observations, BOM, nesting, cost, quote totals, and generated file hashes.
- Production package can reference only a released revision.

## Semantic diff
Compare structured objects before documents:
- parameters
- parts/BOM
- hardware
- edge requirements
- operations/labor
- nesting/sheets/offcuts
- cost categories and total
- quote text and commercial terms

LLM may summarize a structured diff but cannot decide the numeric delta.
