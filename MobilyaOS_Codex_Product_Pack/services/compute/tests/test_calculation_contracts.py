from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.calculation_contracts import (
    BomCalculationRequest,
    BomLine,
    CalculationBoundaryPreviewRequest,
    ConfigurationParameter,
    EdgeBandingRequest,
    EdgeRequirement,
    LaborCostRequest,
    LaborOperationInput,
    MaterialCostLine,
    MaterialCostRequest,
    MeasurementInput,
    MoneyMinor,
    NonProductionCalculationBoundaryAdapter,
    PricingRequest,
    ProductConfigurationInput,
    ProductTemplateRef,
    ProvenanceSource,
    Quantity,
)
from app.main import app


def source(source_id: str = "golden-wardrobe-input") -> ProvenanceSource:
    return ProvenanceSource(source_type="user_input", source_id=source_id)


def formula_source(source_id: str = "formula-v1") -> ProvenanceSource:
    return ProvenanceSource(
        source_type="formula",
        source_id=source_id,
        formula_version="contract-v1",
    )


def price_source(source_id: str = "price-observation-v1") -> ProvenanceSource:
    return ProvenanceSource(
        source_type="price_observation",
        source_id=source_id,
        observed_at="2026-07-18T00:00:00Z",
    )


def wardrobe_configuration(width_mm: int = 1800) -> ProductConfigurationInput:
    return ProductConfigurationInput(
        template=ProductTemplateRef(template_code="wardrobe", template_version="contract-v1"),
        measurements=MeasurementInput(
            width_mm=width_mm,
            height_mm=2200,
            depth_mm=600,
            provenance=source(),
        ),
        quantity=2,
        parameters=[
            ConfigurationParameter(
                key="door_count",
                unit="piece",
                value_int=3,
                provenance=[source("door-count")],
            ),
            ConfigurationParameter(
                key="panel_sku",
                unit="sku",
                value_text="PNL-MDF-18-BEYAZ",
                provenance=[source("panel-sku")],
            ),
        ],
        provenance=[source()],
    )


def test_dimensions_require_strict_positive_integer_millimetres() -> None:
    with pytest.raises(ValidationError):
        MeasurementInput(
            width_mm=1800.5,
            height_mm=2200,
            depth_mm=600,
            provenance=source(),
        )

    with pytest.raises(ValidationError):
        MeasurementInput(width_mm=0, height_mm=2200, depth_mm=600, provenance=source())


def test_money_requires_integer_minor_units() -> None:
    assert MoneyMinor(amount_minor=12345, currency="TRY").amount_minor == 12345

    with pytest.raises(ValidationError):
        MoneyMinor(amount_minor=123.45, currency="TRY")

    with pytest.raises(ValidationError):
        MoneyMinor(amount_minor=10, currency="TL")

    with pytest.raises(ValidationError):
        MoneyMinor(amount_minor=True, currency="TRY")

    with pytest.raises(ValidationError):
        MoneyMinor(amount_minor=-1, currency="TRY")


def test_quantities_reject_binary_float_and_require_explicit_unit() -> None:
    assert Quantity(amount="1.25", unit="meter").amount.as_tuple().exponent == -2

    with pytest.raises(ValidationError):
        Quantity(amount=1.25, unit="meter")

    with pytest.raises(ValidationError):
        Quantity(amount="1", unit="unknown")

    with pytest.raises(ValidationError):
        Quantity(amount=True, unit="piece")


def test_provenance_is_required_and_source_specific() -> None:
    with pytest.raises(ValidationError):
        BomLine(
            code="PANEL-1",
            name="Yan panel",
            width_mm=600,
            height_mm=2200,
            quantity=2,
            material_sku="PNL-MDF-18-BEYAZ",
            provenance=[],
        )

    with pytest.raises(ValidationError):
        ProvenanceSource(source_type="formula", source_id="edge-formula")

    with pytest.raises(ValidationError):
        ProvenanceSource(source_type="price_observation", source_id="price-1")


def test_configuration_parameters_are_typed_and_bounded() -> None:
    valid = ConfigurationParameter(
        key="width_offset",
        unit="mm",
        value_int=25,
        provenance=[source()],
    )

    assert valid.value_int == 25

    with pytest.raises(ValidationError):
        ConfigurationParameter(key="bad", unit="mm", value_text="25", provenance=[source()])

    with pytest.raises(ValidationError):
        ConfigurationParameter(key="bad", unit="boolean", value_int=1, provenance=[source()])


def test_target_gross_margin_cannot_reach_100_percent() -> None:
    with pytest.raises(ValidationError):
        PricingRequest(
            cost=MoneyMinor(amount_minor=10000),
            mode="target_gross_margin",
            rate_bps=10000,
            formula_version="pricing-contract-v1",
            provenance=[source()],
        )


def test_optional_contract_shapes_are_validated_and_hashed() -> None:
    configuration = wardrobe_configuration()
    bom = BomCalculationRequest(
        configuration=configuration,
        formula_version="bom-contract-v1",
    )
    edge = EdgeBandingRequest(
        formula_version="edge-contract-v1",
        edges=[
            EdgeRequirement(
                part_code="PANEL-1",
                edge="north",
                visibility="front-visible",
                band_sku="EDGE-PVC-22-BEYAZ",
                band_thickness_mm=1,
                process="straight",
                length_mm=1800,
                quantity=2,
                waste_bps=500,
                setup_allowance_mm=100,
                provenance=[formula_source("edge-policy")],
            )
        ],
    )
    labor = LaborCostRequest(
        product_quantity=2,
        formula_version="labor-contract-v1",
        operations=[
            LaborOperationInput(
                code="ASM",
                name="Montaj",
                unit_labor_minor=MoneyMinor(amount_minor=50000),
                quantity_per_product=Quantity(amount="1", unit="operation"),
                setup_labor_minor=MoneyMinor(amount_minor=10000),
                batch_labor_minor=MoneyMinor(amount_minor=20000),
                batch_count=1,
                provenance=[formula_source("labor-policy")],
            )
        ],
    )
    materials = MaterialCostRequest(
        formula_version="material-contract-v1",
        materials=[
            MaterialCostLine(
                sku="PNL-MDF-18-BEYAZ",
                quantity=Quantity(amount="2", unit="sheet"),
                unit_price_minor=MoneyMinor(amount_minor=150000),
                price_observation_id="price-obs-1",
                observed_at="2026-07-18T00:00:00Z",
                price_includes_tax=False,
                provenance=[price_source()],
            )
        ],
    )
    request = CalculationBoundaryPreviewRequest(
        configuration=configuration,
        bom=bom,
        edge_banding=edge,
        labor=labor,
        materials=materials,
        pricing=PricingRequest(
            cost=MoneyMinor(amount_minor=100000),
            mode="markup",
            rate_bps=2500,
            formula_version="pricing-contract-v1",
            provenance=[formula_source("pricing-policy")],
        ),
    )

    preview = NonProductionCalculationBoundaryAdapter().preview(request)

    assert preview.validated_shapes == [
        "configuration",
        "bom",
        "edge_banding",
        "labor",
        "materials",
        "pricing",
    ]
    assert len(preview.contract_hash) == 64


def test_non_production_adapter_returns_stable_non_authoritative_preview() -> None:
    adapter = NonProductionCalculationBoundaryAdapter()
    request = CalculationBoundaryPreviewRequest(configuration=wardrobe_configuration())

    first = adapter.preview(request)
    second = adapter.preview(request)
    changed = adapter.preview(
        CalculationBoundaryPreviewRequest(configuration=wardrobe_configuration(1900))
    )

    assert first.authoritative_calculation is False
    assert first.adapter_id == "non_production_contract_adapter"
    assert first.contract_hash == second.contract_hash
    assert first.contract_hash != changed.contract_hash
    assert first.validated_shapes == ["configuration"]
    assert "Authoritative BOM" in " ".join(first.warnings)


def test_boundary_preview_endpoint_is_not_authoritative() -> None:
    client = TestClient(app)

    response = client.post(
        "/api/v1/calculations/boundary-preview",
        json=CalculationBoundaryPreviewRequest(configuration=wardrobe_configuration()).model_dump(
            mode="json"
        ),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["authoritative_calculation"] is False
    assert payload["adapter_id"] == "non_production_contract_adapter"
    assert payload["validated_shapes"] == ["configuration"]
    assert "bom" not in payload
    assert "grand_total" not in payload


def test_boundary_preview_endpoint_rejects_invalid_payload_without_echoing_input() -> None:
    client = TestClient(app)

    response = client.post(
        "/api/v1/calculations/boundary-preview",
        json={
            "configuration": {
                "template": {"template_code": "wardrobe", "template_version": "contract-v1"},
                "measurements": {
                    "width_mm": 0,
                    "height_mm": 2200,
                    "depth_mm": 600,
                    "provenance": {
                        "source_type": "user_input",
                        "source_id": "invalid-secret-like-value",
                    },
                },
                "quantity": 2,
                "provenance": [{"source_type": "user_input", "source_id": "config"}],
            }
        },
    )

    assert response.status_code == 422
    payload_text = str(response.json())
    assert "input" not in payload_text
    assert "invalid-secret-like-value" not in payload_text


def test_nesting_preview_is_explicitly_non_authoritative() -> None:
    client = TestClient(app)

    response = client.post(
        "/api/v1/nesting/preview",
        json={
            "sheet_width_mm": 2800,
            "sheet_height_mm": 2070,
            "kerf_mm": 4,
            "parts": [{"code": "P1", "width_mm": 600, "height_mm": 2200, "quantity": 2}],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["authoritative_calculation"] is False
    assert "sheet_count" not in payload
