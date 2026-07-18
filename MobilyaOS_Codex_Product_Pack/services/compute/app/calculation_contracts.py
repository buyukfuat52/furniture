from __future__ import annotations

import hashlib
from decimal import Decimal
from typing import Annotated, Any, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StrictBool,
    StrictInt,
    field_validator,
    model_validator,
)


PositiveMm = Annotated[StrictInt, Field(gt=0)]
NonNegativeMm = Annotated[StrictInt, Field(ge=0)]
PositiveCount = Annotated[StrictInt, Field(gt=0)]
NonNegativeMinor = Annotated[StrictInt, Field(ge=0)]
Bps = Annotated[StrictInt, Field(ge=0, le=10_000)]
MarginBps = Annotated[StrictInt, Field(ge=0, lt=10_000)]


class BoundaryModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ProvenanceSource(BoundaryModel):
    source_type: Literal[
        "user_input",
        "product_template",
        "price_observation",
        "formula",
        "deterministic_adapter",
    ]
    source_id: str = Field(min_length=1, max_length=160)
    formula_version: str | None = Field(default=None, max_length=80)
    observed_at: str | None = Field(default=None, max_length=40)

    @model_validator(mode="after")
    def require_source_specific_fields(self) -> ProvenanceSource:
        if self.source_type in {"formula", "deterministic_adapter"} and not self.formula_version:
            raise ValueError("formula provenance requires formula_version")
        if self.source_type == "price_observation" and not self.observed_at:
            raise ValueError("price observation provenance requires observed_at")
        return self


class MoneyMinor(BoundaryModel):
    amount_minor: NonNegativeMinor
    currency: str = Field(default="TRY", pattern=r"^[A-Z]{3}$")


class Quantity(BoundaryModel):
    amount: Decimal
    unit: Literal["piece", "meter", "square_meter", "hour", "sheet", "operation"]

    @field_validator("amount", mode="before")
    @classmethod
    def reject_binary_float(cls, value: Any) -> Any:
        if isinstance(value, bool | float):
            raise ValueError("quantity must not use binary float")
        return value

    @field_validator("amount")
    @classmethod
    def require_positive_quantity(cls, value: Decimal) -> Decimal:
        if value <= Decimal("0"):
            raise ValueError("quantity must be positive")
        return value


class MeasurementInput(BoundaryModel):
    width_mm: PositiveMm
    height_mm: PositiveMm
    depth_mm: PositiveMm | None = None
    provenance: ProvenanceSource


class ProductTemplateRef(BoundaryModel):
    template_code: str = Field(min_length=1, max_length=80)
    template_version: str = Field(min_length=1, max_length=80)


class ConfigurationParameter(BoundaryModel):
    key: str = Field(min_length=1, max_length=80, pattern=r"^[a-zA-Z0-9_]+$")
    unit: Literal["mm", "piece", "boolean", "sku", "text"]
    value_int: StrictInt | None = None
    value_text: str | None = Field(default=None, max_length=160)
    value_bool: StrictBool | None = None
    provenance: list[ProvenanceSource] = Field(min_length=1)

    @model_validator(mode="after")
    def require_typed_value(self) -> ConfigurationParameter:
        supplied = [
            self.value_int is not None,
            self.value_text is not None,
            self.value_bool is not None,
        ]
        if sum(supplied) != 1:
            raise ValueError("configuration parameter requires exactly one typed value")
        if self.unit in {"mm", "piece"}:
            if self.value_int is None or self.value_int <= 0:
                raise ValueError("mm and piece parameters require a positive integer value")
        elif self.unit == "boolean":
            if self.value_bool is None:
                raise ValueError("boolean parameters require value_bool")
        elif self.unit in {"sku", "text"}:
            if not self.value_text:
                raise ValueError("sku and text parameters require value_text")
        return self


class ProductConfigurationInput(BoundaryModel):
    template: ProductTemplateRef
    measurements: MeasurementInput
    quantity: PositiveCount
    parameters: list[ConfigurationParameter] = Field(default_factory=list, max_length=80)
    provenance: list[ProvenanceSource] = Field(min_length=1)


class BomLine(BoundaryModel):
    code: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=160)
    width_mm: PositiveMm
    height_mm: PositiveMm
    quantity: PositiveCount
    material_sku: str = Field(min_length=1, max_length=80)
    provenance: list[ProvenanceSource] = Field(min_length=1)


class BomCalculationRequest(BoundaryModel):
    configuration: ProductConfigurationInput
    formula_version: str = Field(min_length=1, max_length=80)


class BomCalculationResponse(BoundaryModel):
    authoritative_calculation: Literal[False]
    formula_version: str
    lines: list[BomLine] = Field(max_length=500)
    provenance: list[ProvenanceSource] = Field(min_length=1)


class EdgeRequirement(BoundaryModel):
    part_code: str = Field(min_length=1, max_length=80)
    edge: Literal["north", "east", "south", "west"]
    visibility: Literal[
        "front-visible", "side-visible", "interior-visible", "hidden", "wall-contact"
    ]
    band_sku: str = Field(min_length=1, max_length=80)
    band_thickness_mm: PositiveMm
    process: Literal["straight", "45-degree mitre", "groove/profile", "none"]
    override_reason: str | None = Field(default=None, max_length=180)
    override_actor_id: str | None = Field(default=None, max_length=160)
    length_mm: PositiveMm
    quantity: PositiveCount
    waste_bps: Bps
    setup_allowance_mm: NonNegativeMm
    provenance: list[ProvenanceSource] = Field(min_length=1)


class EdgeBandingRequest(BoundaryModel):
    edges: list[EdgeRequirement] = Field(min_length=1, max_length=2_000)
    formula_version: str = Field(min_length=1, max_length=80)


class EdgeBandingResponse(BoundaryModel):
    authoritative_calculation: Literal[False]
    base_length_mm: NonNegativeMm
    billable_length_mm: NonNegativeMm
    formula_version: str
    provenance: list[ProvenanceSource] = Field(min_length=1)


class LaborOperationInput(BoundaryModel):
    code: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=160)
    unit_labor_minor: MoneyMinor
    quantity_per_product: Quantity
    setup_labor_minor: MoneyMinor | None = None
    batch_labor_minor: MoneyMinor | None = None
    batch_count: PositiveCount | None = None
    provenance: list[ProvenanceSource] = Field(min_length=1)

    @model_validator(mode="after")
    def require_batch_count_with_batch_labor(self) -> LaborOperationInput:
        if self.batch_labor_minor is not None and self.batch_count is None:
            raise ValueError("batch labor requires batch_count")
        return self


class LaborCostRequest(BoundaryModel):
    product_quantity: PositiveCount
    operations: list[LaborOperationInput] = Field(min_length=1, max_length=200)
    formula_version: str = Field(min_length=1, max_length=80)


class LaborCostResponse(BoundaryModel):
    authoritative_calculation: Literal[False]
    unit_labor_total: MoneyMinor
    setup_labor_total: MoneyMinor
    formula_version: str
    provenance: list[ProvenanceSource] = Field(min_length=1)


class MaterialCostLine(BoundaryModel):
    sku: str = Field(min_length=1, max_length=80)
    quantity: Quantity
    unit_price_minor: MoneyMinor
    price_observation_id: str = Field(min_length=1, max_length=160)
    observed_at: str = Field(min_length=1, max_length=40)
    valid_from: str | None = Field(default=None, max_length=40)
    valid_until: str | None = Field(default=None, max_length=40)
    price_includes_tax: StrictBool
    pack_quantity: Quantity | None = None
    conversion_factor: Quantity | None = None
    provenance: list[ProvenanceSource] = Field(min_length=1)


class MaterialCostRequest(BoundaryModel):
    materials: list[MaterialCostLine] = Field(min_length=1, max_length=500)
    formula_version: str = Field(min_length=1, max_length=80)


class MaterialCostResponse(BoundaryModel):
    authoritative_calculation: Literal[False]
    total_material_minor: MoneyMinor
    formula_version: str
    provenance: list[ProvenanceSource] = Field(min_length=1)


class PricingRequest(BoundaryModel):
    cost: MoneyMinor
    mode: Literal["markup", "target_gross_margin"]
    rate_bps: Bps | MarginBps
    formula_version: str = Field(min_length=1, max_length=80)
    provenance: list[ProvenanceSource] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_margin_rate(self) -> PricingRequest:
        if self.mode == "target_gross_margin" and self.rate_bps >= 10_000:
            raise ValueError("target gross margin must be below 100%")
        return self


class PricingResponse(BoundaryModel):
    authoritative_calculation: Literal[False]
    sell_price_minor: MoneyMinor
    formula_version: str
    provenance: list[ProvenanceSource] = Field(min_length=1)


class QuoteTotalRequest(BoundaryModel):
    line_totals: list[MoneyMinor] = Field(min_length=1, max_length=500)
    discount_minor: MoneyMinor
    vat_bps: Bps
    rounding_policy: Literal["none", "nearest_lira", "nearest_10_lira"]
    formula_version: str = Field(min_length=1, max_length=80)
    provenance: list[ProvenanceSource] = Field(min_length=1)

    @model_validator(mode="after")
    def require_currency_consistency_and_discount_sanity(self) -> QuoteTotalRequest:
        currencies = {line.currency for line in self.line_totals}
        currencies.add(self.discount_minor.currency)
        if len(currencies) != 1:
            raise ValueError("quote total request requires one currency")
        subtotal = sum(line.amount_minor for line in self.line_totals)
        if self.discount_minor.amount_minor > subtotal:
            raise ValueError("discount cannot exceed subtotal")
        return self


class QuoteTotalResponse(BoundaryModel):
    authoritative_calculation: Literal[False]
    subtotal_minor: MoneyMinor
    discount_minor: MoneyMinor
    vat_minor: MoneyMinor
    grand_total_minor: MoneyMinor
    formula_version: str
    provenance: list[ProvenanceSource] = Field(min_length=1)


class CalculationBoundaryPreviewRequest(BoundaryModel):
    configuration: ProductConfigurationInput
    bom: BomCalculationRequest | None = None
    edge_banding: EdgeBandingRequest | None = None
    labor: LaborCostRequest | None = None
    materials: MaterialCostRequest | None = None
    pricing: PricingRequest | None = None
    quote_total: QuoteTotalRequest | None = None


class CalculationBoundaryPreviewResponse(BoundaryModel):
    authoritative_calculation: Literal[False]
    adapter_id: Literal["non_production_contract_adapter"]
    adapter_version: str
    contract_hash: str
    validated_shapes: list[str]
    warnings: list[str]


class NonProductionCalculationBoundaryAdapter:
    adapter_id: Literal["non_production_contract_adapter"] = "non_production_contract_adapter"
    adapter_version = "contract-preview-v1"

    def preview(
        self, request: CalculationBoundaryPreviewRequest
    ) -> CalculationBoundaryPreviewResponse:
        payload = request.model_dump_json(exclude_none=True)
        validated = ["configuration"]
        for name in ["bom", "edge_banding", "labor", "materials", "pricing", "quote_total"]:
            if getattr(request, name) is not None:
                validated.append(name)
        return CalculationBoundaryPreviewResponse(
            authoritative_calculation=False,
            adapter_id=self.adapter_id,
            adapter_version=self.adapter_version,
            contract_hash=hashlib.sha256(payload.encode("utf-8")).hexdigest(),
            validated_shapes=validated,
            warnings=[
                "Non-production contract adapter. It validates boundary shape only.",
                "Authoritative BOM, edge, labor, cost, pricing, and quote totals must come from deterministic domain services.",
            ],
        )
