from __future__ import annotations

from typing import Literal

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.agent_runtime import (
    AgentRuntime,
    ChatRequest,
    ChatResponse,
    repository_root,
    request_with_authorized_context,
)
from app.calculation_contracts import (
    CalculationBoundaryPreviewRequest,
    CalculationBoundaryPreviewResponse,
    NonProductionCalculationBoundaryAdapter,
    NonNegativeMm,
    PositiveCount,
    PositiveMm,
)
from app.settings import load_settings
from app.tool_gateway_policy import ToolPolicyManifest, tool_policy_manifest


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: str
    version: str
    model_provider: str


class RulesModeResponse(BaseModel):
    mode: Literal["rules"]
    message: str
    authoritative_calculation: Literal[False]
    core_base_url: str


class PanelPart(BaseModel):
    code: str = Field(min_length=1)
    width_mm: PositiveMm
    height_mm: PositiveMm
    quantity: PositiveCount
    grain: Literal["none", "vertical", "horizontal"] = "none"


class NestingPreviewRequest(BaseModel):
    sheet_width_mm: PositiveMm
    sheet_height_mm: PositiveMm
    kerf_mm: NonNegativeMm
    parts: list[PanelPart] = Field(max_length=500)


class NestingPreviewResponse(BaseModel):
    solver: Literal["p2-preview-not-authoritative"]
    authoritative_calculation: Literal[False]
    accepted_part_count: int
    warnings: list[str]


app = FastAPI(title="MobilyaOS Compute API", version="0.1.0")
agent_runtime = AgentRuntime(repository_root())
calculation_boundary_adapter = NonProductionCalculationBoundaryAdapter()


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    _request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    safe_errors = [
        {
            "loc": error.get("loc", ()),
            "msg": error.get("msg", "Invalid request"),
            "type": error.get("type", "value_error"),
        }
        for error in exc.errors()
    ]
    return JSONResponse(status_code=422, content={"detail": safe_errors})


@app.get("/healthz", response_model=HealthResponse)
@app.get("/api/v1/health", response_model=HealthResponse)
def health() -> HealthResponse:
    settings = load_settings()
    return HealthResponse(
        status="ok",
        service="compute",
        version="0.1.0",
        model_provider=settings.model_provider,
    )


@app.get("/api/v1/agent/rules-mode", response_model=RulesModeResponse)
def rules_mode() -> RulesModeResponse:
    settings = load_settings()
    return RulesModeResponse(
        mode="rules",
        message=(
            "Model provider is disabled or not configured. The service can explain policies "
            "and call authorized tools later, but cannot calculate authoritative values."
        ),
        authoritative_calculation=False,
        core_base_url=settings.core_base_url,
    )


@app.get("/api/v1/agent/tool-gateway/policies", response_model=ToolPolicyManifest)
def agent_tool_gateway_policies() -> ToolPolicyManifest:
    return tool_policy_manifest()


@app.post("/api/v1/agent/chat", response_model=ChatResponse)
def agent_chat(request: ChatRequest, authorization: str = Header(default="")) -> ChatResponse:
    token = authorization.removeprefix("Bearer ").strip()
    authorized = request_with_authorized_context(request, token)
    if authorized is None:
        raise HTTPException(
            status_code=401, detail="Agent chat requires a valid demo bearer token."
        )
    return agent_runtime.chat(authorized)


@app.post("/api/v1/nesting/preview", response_model=NestingPreviewResponse)
def nesting_preview(request: NestingPreviewRequest) -> NestingPreviewResponse:
    total_parts = sum(part.quantity for part in request.parts)
    return NestingPreviewResponse(
        solver="p2-preview-not-authoritative",
        authoritative_calculation=False,
        accepted_part_count=total_parts,
        warnings=[
            "P2 preview only. Final sheet count must come from the deterministic nesting engine.",
            f"Received {total_parts} part instances with kerf {request.kerf_mm} mm.",
        ],
    )


@app.post(
    "/api/v1/calculations/boundary-preview",
    response_model=CalculationBoundaryPreviewResponse,
)
def calculation_boundary_preview(
    request: CalculationBoundaryPreviewRequest,
) -> CalculationBoundaryPreviewResponse:
    return calculation_boundary_adapter.preview(request)
