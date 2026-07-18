from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, Field

from app.calculation_contracts import MoneyMinor
from app.tool_gateway_policy import (
    DEMO_COMPANY_ID,
    ToolPolicyDecision,
    evaluate_tool_request,
    tool_policy_for_adapter,
)


AgentID = Literal[
    "enterprise_search",
    "costing_pricing",
    "revision_diff",
    "quote_document",
]
ResponseStatus = Literal["completed", "needs_input", "needs_approval", "failed", "informational"]
ToolStatus = Literal["completed", "denied", "approval_required"]

DEMO_PROJECT_ID = "proj-demo-wardrobe"
DEMO_REVISION_ID = "rev-demo-wardrobe-r1"
DEMO_FORK_REVISION_ID = "rev-demo-wardrobe-r2"
DEMO_TOKEN_CONTEXTS: dict[str, tuple[str, list[str]]] = {
    "demo-admin-token": ("22222222-2222-4222-8222-222222222222", ["admin"]),
    "demo-sales-token": ("33333333-3333-4333-8333-333333333333", ["sales"]),
    "demo-viewer-token": ("66666666-6666-4666-8666-666666666666", ["viewer"]),
}


class Source(BaseModel):
    type: str
    id: str
    revision_id: str | None = None
    tool_call_id: str | None = None


class Fact(BaseModel):
    label: str
    value: Any
    unit: str | None = None
    source: Source


class ProposedAction(BaseModel):
    action: str
    description: str
    risk: Literal["read_only", "low", "financial", "external", "production", "destructive"]
    approval_required: bool
    idempotency_key: str | None = None
    approval_id: str | None = None


class Approval(BaseModel):
    required: bool
    state: Literal["not_required", "missing", "pending", "approved", "rejected"]
    approval_id: str | None = None


class Reference(BaseModel):
    type: str
    id: str
    label: str | None = None


class AgentStructuredResponse(BaseModel):
    status: ResponseStatus
    summary: str
    facts: list[Fact]
    proposed_actions: list[ProposedAction]
    approval: Approval
    warnings: list[str]
    missing_information: list[str]
    references: list[Reference]


class CostCategory(BaseModel):
    category: str
    amount: MoneyMinor


class CostSnapshot(BaseModel):
    categories: list[CostCategory] = Field(default_factory=list)
    subtotal: MoneyMinor | None = None
    markup: MoneyMinor | None = None
    vat: MoneyMinor | None = None
    grand_total: MoneyMinor | None = None
    formula_version: str = "wardrobe-cost-v1"


class DiffEntry(BaseModel):
    category: str
    field: str
    before: str
    after: str


class ChatContext(BaseModel):
    company_id: str = DEMO_COMPANY_ID
    user_id: str = "demo-sales-user"
    roles: list[str] = Field(default_factory=lambda: ["sales"])
    locale: str = "tr-TR"
    project_id: str | None = None
    revision_id: str | None = None
    left_revision_id: str | None = None
    right_revision_id: str | None = None
    cost_snapshot: CostSnapshot | None = None
    untrusted_cost_snapshot_supplied: bool = False
    diff_entries: list[DiffEntry] = Field(default_factory=list)
    untrusted_diff_entries_supplied: bool = False
    expected_version: int | None = None
    approval_token: str | None = None


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    context: ChatContext = Field(default_factory=ChatContext)


def request_with_authorized_context(request: ChatRequest, bearer_token: str) -> ChatRequest | None:
    token_context = DEMO_TOKEN_CONTEXTS.get(bearer_token)
    if token_context is None:
        return None
    actor_id, roles = token_context
    untrusted_cost_snapshot_supplied = request.context.cost_snapshot is not None
    untrusted_diff_entries_supplied = len(request.context.diff_entries) > 0
    return request.model_copy(
        update={
            "context": request.context.model_copy(
                update={
                    "company_id": DEMO_COMPANY_ID,
                    "user_id": actor_id,
                    "roles": roles,
                    "cost_snapshot": None,
                    "untrusted_cost_snapshot_supplied": untrusted_cost_snapshot_supplied,
                    "diff_entries": [],
                    "untrusted_diff_entries_supplied": untrusted_diff_entries_supplied,
                    "approval_token": None,
                }
            )
        }
    )


class ToolCallRecord(BaseModel):
    id: str
    tool: str
    action: str
    agent_id: AgentID
    status: ToolStatus
    approval_required: bool
    summary: str


class ChatResponse(BaseModel):
    agent_id: AgentID
    classification: str
    mode: Literal["rules"]
    prompt_versions: list[Reference]
    tool_calls: list[ToolCallRecord]
    response: AgentStructuredResponse


class PromptBundle(BaseModel):
    base: str
    agent: str
    references: list[Reference]


@dataclass(frozen=True)
class GatewayResult:
    record: ToolCallRecord
    facts: list[Fact]
    actions: list[ProposedAction]
    references: list[Reference]
    warnings: list[str]
    missing: list[str]


class PromptRegistry:
    def __init__(self, repository_root: Path) -> None:
        self._root = repository_root

    def load(self, agent_id: AgentID) -> PromptBundle:
        base_path = self._root / "prompts" / "system" / "base.md"
        agent_path = self._root / "prompts" / "system" / "agents" / f"{agent_id}.md"
        return PromptBundle(
            base=base_path.read_text(encoding="utf-8"),
            agent=agent_path.read_text(encoding="utf-8"),
            references=[
                Reference(type="prompt", id="mobilia.system.base@1.0.0", label="system.base"),
                Reference(
                    type="prompt", id=f"mobilia.agent.{agent_id}@1.0.0", label=f"agent.{agent_id}"
                ),
            ],
        )


class ToolGateway:
    def call(
        self,
        *,
        agent_id: AgentID,
        tool: str,
        action: str,
        context: ChatContext,
        untrusted_text: str | None = None,
    ) -> GatewayResult:
        policy = tool_policy_for_adapter(
            agent_id=agent_id, adapter_tool=tool, adapter_action=action
        )
        if policy is None:
            return self._denied(
                agent_id,
                tool,
                action,
                "tool gateway has no policy for this agent/tool/action",
            )
        decision = evaluate_tool_request(
            agent_id=agent_id,
            tool_name=policy.name,
            roles=context.roles,
            company_id=context.company_id,
            session_present=True,
            idempotency_key=self._server_idempotency_key(policy.name, context),
            approval_granted=False,
            untrusted_text=untrusted_text,
        )
        if not decision.allowed:
            return self._policy_blocked(agent_id, tool, action, decision)
        if tool == "project_tool" and action == "search":
            return self._project_search(agent_id, context)
        if tool == "document_tool" and action == "search":
            return self._proposal_search(agent_id, context)
        if tool == "costing_tool" and action == "get_cost_snapshot":
            return self._cost_snapshot(agent_id, context)
        if tool in {"manufacturing_tool", "costing_tool", "document_tool"} and action.endswith(
            "_diff"
        ):
            return self._revision_diff(agent_id, tool, action, context)
        if tool == "document_tool" and action == "get_quote_document":
            return self._quote_document(agent_id, context)
        if tool == "document_tool" and action == "send_quote":
            return self._approval_required(agent_id, tool, action)
        if tool == "workflow_tool" and action == "request_approval":
            return self._approval_request(agent_id, context)
        return self._denied(agent_id, tool, action, "tool gateway has no registered safe adapter")

    def _server_idempotency_key(self, policy_name: str, context: ChatContext) -> str | None:
        if policy_name in {
            "create_customer_draft",
            "create_project_draft",
            "create_quote_draft",
            "create_quote_configuration_draft",
            "update_quote_configuration_draft",
            "request_quote_approval",
            "send_quote",
            "approve_quote",
            "approve_quote_from_chat",
            "consume_approval_token_from_chat",
            "mutate_quote_from_chat",
            "generate_pdf",
            "create_production_package",
            "generate_production_package",
        }:
            target = context.revision_id or context.project_id or "no-target"
            return f"server-scoped-{policy_name}-{target}"
        return None

    def _record(
        self,
        agent_id: AgentID,
        tool: str,
        action: str,
        status: ToolStatus,
        summary: str,
        approval_required: bool = False,
    ) -> ToolCallRecord:
        return ToolCallRecord(
            id=f"tool-{uuid4()}",
            tool=tool,
            action=action,
            agent_id=agent_id,
            status=status,
            approval_required=approval_required,
            summary=summary,
        )

    def _denied(self, agent_id: AgentID, tool: str, action: str, reason: str) -> GatewayResult:
        record = self._record(agent_id, tool, action, "denied", reason)
        return GatewayResult(record, [], [], [], [reason], [])

    def _policy_blocked(
        self,
        agent_id: AgentID,
        tool: str,
        action: str,
        decision: ToolPolicyDecision,
    ) -> GatewayResult:
        status: ToolStatus = (
            "approval_required" if decision.status == "approval_required" else "denied"
        )
        record = self._record(
            agent_id,
            tool,
            action,
            status,
            decision.reason,
            approval_required=decision.requires_approval,
        )
        warnings = [*decision.warnings, decision.reason]
        return GatewayResult(record, [], [], [], warnings, [])

    def _approval_required(self, agent_id: AgentID, tool: str, action: str) -> GatewayResult:
        record = self._record(
            agent_id,
            tool,
            action,
            "approval_required",
            "human approval is required before quote_send",
            True,
        )
        return GatewayResult(
            record,
            [],
            [],
            [],
            ["quote_send was not executed"],
            [],
        )

    def _project_search(self, agent_id: AgentID, context: ChatContext) -> GatewayResult:
        if context.project_id is not None and context.project_id != DEMO_PROJECT_ID:
            return self._denied(
                agent_id,
                "project_tool",
                "search",
                "project_id was not found in the authorized tenant tool adapter",
            )
        record = self._record(agent_id, "project_tool", "search", "completed", "1 project returned")
        fact = Fact(
            label="Bulunan proje",
            value={
                "project_id": context.project_id or DEMO_PROJECT_ID,
                "customer": "Ayse Yilmaz",
                "name": "Ayse Yilmaz Vestiyer",
                "status": "draft",
            },
            source=Source(type="tool_result", id="project_tool.search", tool_call_id=record.id),
        )
        return GatewayResult(
            record,
            [fact],
            [],
            [
                Reference(
                    type="project",
                    id=context.project_id or DEMO_PROJECT_ID,
                    label="Ayse Yilmaz Vestiyer",
                )
            ],
            [],
            [],
        )

    def _proposal_search(self, agent_id: AgentID, context: ChatContext) -> GatewayResult:
        if context.revision_id is not None and context.revision_id != DEMO_REVISION_ID:
            return self._denied(
                agent_id,
                "document_tool",
                "search",
                "revision_id was not found in the authorized tenant tool adapter",
            )
        record = self._record(
            agent_id, "document_tool", "search", "completed", "1 proposal returned"
        )
        revision_id = context.revision_id or DEMO_REVISION_ID
        fact = Fact(
            label="Bulunan teklif",
            value={"revision_id": revision_id, "document_status": "preview_available"},
            source=Source(
                type="tool_result",
                id="document_tool.search",
                revision_id=revision_id,
                tool_call_id=record.id,
            ),
        )
        return GatewayResult(
            record,
            [fact],
            [],
            [Reference(type="quote_revision", id=revision_id, label="Teklif revizyonu")],
            [],
            [],
        )

    def _cost_snapshot(self, agent_id: AgentID, context: ChatContext) -> GatewayResult:
        if context.untrusted_cost_snapshot_supplied:
            record = self._record(
                agent_id,
                "costing_tool",
                "get_cost_snapshot",
                "denied",
                "browser-supplied cost snapshot was ignored",
            )
            return GatewayResult(
                record,
                [],
                [],
                [],
                ["browser-supplied cost snapshot is not authoritative and was ignored"],
                ["trusted_cost_snapshot"],
            )
        record = self._record(
            agent_id,
            "costing_tool",
            "get_cost_snapshot",
            "denied",
            "trusted cost snapshot is missing",
        )
        return GatewayResult(record, [], [], [], [], ["trusted_cost_snapshot"])

    def _revision_is_authorized(self, revision_id: str) -> bool:
        return revision_id in {DEMO_REVISION_ID, DEMO_FORK_REVISION_ID}

    def _revision_status(self, revision_id: str) -> str | None:
        if revision_id == DEMO_REVISION_ID:
            return "draft"
        if revision_id == DEMO_FORK_REVISION_ID:
            return "sent"
        return None

    def _revision_version(self, revision_id: str) -> int | None:
        if revision_id == DEMO_REVISION_ID:
            return 1
        if revision_id == DEMO_FORK_REVISION_ID:
            return 2
        return None

    def _revision_diff(
        self, agent_id: AgentID, tool: str, action: str, context: ChatContext
    ) -> GatewayResult:
        if context.untrusted_diff_entries_supplied:
            return self._denied(
                agent_id,
                tool,
                action,
                "browser-supplied revision diff was ignored; trusted deterministic diff is required",
            )
        left_revision_id = context.left_revision_id or DEMO_REVISION_ID
        right_revision_id = context.right_revision_id or DEMO_FORK_REVISION_ID
        if not self._revision_is_authorized(left_revision_id) or not self._revision_is_authorized(
            right_revision_id
        ):
            return self._denied(
                agent_id,
                tool,
                action,
                "revision_id was not found in the authorized tenant tool adapter",
            )
        record = self._record(agent_id, tool, action, "completed", "revision diff returned")
        entries = [
            DiffEntry(category="parameter", field="width_mm", before="1800", after="2000"),
            DiffEntry(category="parameter", field="quantity", before="2", after="3"),
        ]
        facts = [
            Fact(
                label=f"{entry.category}.{entry.field}",
                value={"once": entry.before, "sonra": entry.after},
                source=Source(
                    type="tool_result",
                    id=f"{tool}.{action}",
                    revision_id=right_revision_id,
                    tool_call_id=record.id,
                ),
            )
            for entry in entries
        ]
        return GatewayResult(
            record,
            facts,
            [],
            [
                Reference(
                    type="quote_revision",
                    id=left_revision_id,
                    label="Once",
                ),
                Reference(
                    type="quote_revision",
                    id=right_revision_id,
                    label="Sonra",
                ),
            ],
            [],
            [],
        )

    def _quote_document(self, agent_id: AgentID, context: ChatContext) -> GatewayResult:
        revision_id = context.revision_id
        record = self._record(
            agent_id,
            "document_tool",
            "get_quote_document",
            "completed" if revision_id else "denied",
            "quote document returned" if revision_id else "revision_id is required",
        )
        if revision_id is None:
            return GatewayResult(record, [], [], [], [], ["revision_id"])
        if not self._revision_is_authorized(revision_id):
            return self._denied(
                agent_id,
                "document_tool",
                "get_quote_document",
                "revision_id was not found in the authorized tenant tool adapter",
            )
        if (
            context.expected_version is not None
            and context.expected_version != self._revision_version(revision_id)
        ):
            return self._denied(
                agent_id,
                "document_tool",
                "get_quote_document",
                "revision version is stale in the authorized tenant tool adapter",
            )
        return GatewayResult(
            record,
            [
                Fact(
                    label="Teklif onizleme",
                    value={"revision_id": revision_id, "template_id": "corporate-tr-v1"},
                    source=Source(
                        type="tool_result",
                        id="document_tool.get_quote_document",
                        revision_id=revision_id,
                        tool_call_id=record.id,
                    ),
                )
            ],
            [
                ProposedAction(
                    action="quote_preview",
                    description="Musteriye gosterilecek teklif onizlemesi hazirlandi.",
                    risk="read_only",
                    approval_required=False,
                )
            ],
            [Reference(type="quote_revision", id=revision_id, label="Teklif onizleme")],
            [],
            [],
        )

    def _approval_request(self, agent_id: AgentID, context: ChatContext) -> GatewayResult:
        revision_id = context.revision_id
        record = self._record(
            agent_id,
            "workflow_tool",
            "request_approval",
            "completed" if revision_id else "denied",
            "approval workflow initiated" if revision_id else "revision_id is required",
        )
        if revision_id is None:
            return GatewayResult(record, [], [], [], [], ["revision_id"])
        if not self._revision_is_authorized(revision_id):
            return self._denied(
                agent_id,
                "workflow_tool",
                "request_approval",
                "revision_id was not found in the authorized tenant tool adapter",
            )
        if self._revision_status(revision_id) != "draft":
            return self._denied(
                agent_id,
                "workflow_tool",
                "request_approval",
                "approval request requires a mutable draft revision",
            )
        if context.expected_version != self._revision_version(revision_id):
            return self._denied(
                agent_id,
                "workflow_tool",
                "request_approval",
                "expected revision version is required before approval request",
            )
        approval_id = f"approval-{revision_id}"
        return GatewayResult(
            record,
            [
                Fact(
                    label="Onay sureci",
                    value={"approval_id": approval_id, "state": "pending"},
                    source=Source(
                        type="tool_result",
                        id="workflow_tool.request_approval",
                        revision_id=revision_id,
                        tool_call_id=record.id,
                    ),
                )
            ],
            [
                ProposedAction(
                    action="quote_send",
                    description="Teklif gonderimi onaydan sonra ayri bir adimda calistirilabilir.",
                    risk="external",
                    approval_required=True,
                    approval_id=approval_id,
                )
            ],
            [Reference(type="approval", id=approval_id, label="Teklif onayi")],
            [],
            [],
        )


class AgentRuntime:
    def __init__(self, repository_root: Path) -> None:
        self._prompts = PromptRegistry(repository_root)
        self._gateway = ToolGateway()

    def chat(self, request: ChatRequest) -> ChatResponse:
        agent_id = classify_message(request.message)
        prompt_bundle = self._prompts.load(agent_id)
        injection_warnings = detect_prompt_injection(request.message)
        if wants_policy_bypass(request.message):
            structured = AgentStructuredResponse(
                status="failed",
                summary="Bu istek guvenlik politikasini veya onay akisini atlatmaya calisiyor; arac cagrisi yapilmadi.",
                facts=[],
                proposed_actions=[],
                approval=Approval(required=False, state="not_required"),
                warnings=injection_warnings + ["policy bypass request blocked"],
                missing_information=[],
                references=prompt_bundle.references,
            )
            return ChatResponse(
                agent_id=agent_id,
                classification=agent_id,
                mode="rules",
                prompt_versions=prompt_bundle.references,
                tool_calls=[],
                response=structured,
            )
        if wants_cross_tenant(request.message):
            structured = AgentStructuredResponse(
                status="failed",
                summary="Bu istek sirket sinirini asmaya calisiyor; yalnizca yetkili sirket verisi kullanilabilir.",
                facts=[],
                proposed_actions=[],
                approval=Approval(required=False, state="not_required"),
                warnings=injection_warnings + ["cross-tenant data request blocked"],
                missing_information=[],
                references=prompt_bundle.references,
            )
            return ChatResponse(
                agent_id=agent_id,
                classification=agent_id,
                mode="rules",
                prompt_versions=prompt_bundle.references,
                tool_calls=[],
                response=structured,
            )

        tool_results = self._run_agent(agent_id, request)
        facts = [fact for result in tool_results for fact in result.facts]
        actions = [action for result in tool_results for action in result.actions]
        references = prompt_bundle.references + [
            reference for result in tool_results for reference in result.references
        ]
        warnings = injection_warnings + [
            warning for result in tool_results for warning in result.warnings
        ]
        missing = sorted({item for result in tool_results for item in result.missing})
        tool_calls = [result.record for result in tool_results]
        status = determine_status(tool_calls, actions, missing)
        structured = AgentStructuredResponse(
            status=status,
            summary=summary_for(agent_id, status, facts, actions, warnings, missing),
            facts=facts,
            proposed_actions=actions,
            approval=approval_for(tool_calls, actions),
            warnings=warnings,
            missing_information=missing,
            references=references,
        )
        return ChatResponse(
            agent_id=agent_id,
            classification=agent_id,
            mode="rules",
            prompt_versions=prompt_bundle.references,
            tool_calls=tool_calls,
            response=structured,
        )

    def _run_agent(self, agent_id: AgentID, request: ChatRequest) -> list[GatewayResult]:
        context = request.context
        if agent_id == "enterprise_search":
            return [
                self._gateway.call(
                    agent_id=agent_id,
                    tool="project_tool",
                    action="search",
                    context=context,
                    untrusted_text=request.message,
                ),
                self._gateway.call(
                    agent_id=agent_id,
                    tool="document_tool",
                    action="search",
                    context=context,
                    untrusted_text=request.message,
                ),
            ]
        if agent_id == "costing_pricing":
            return [
                self._gateway.call(
                    agent_id=agent_id,
                    tool="costing_tool",
                    action="get_cost_snapshot",
                    context=context,
                    untrusted_text=request.message,
                )
            ]
        if agent_id == "revision_diff":
            return [
                self._gateway.call(
                    agent_id=agent_id,
                    tool="manufacturing_tool",
                    action="get_revision_diff",
                    context=context,
                    untrusted_text=request.message,
                ),
                self._gateway.call(
                    agent_id=agent_id,
                    tool="costing_tool",
                    action="cost_diff",
                    context=context,
                    untrusted_text=request.message,
                ),
                self._gateway.call(
                    agent_id=agent_id,
                    tool="document_tool",
                    action="document_diff",
                    context=context,
                    untrusted_text=request.message,
                ),
            ]
        send_requested = wants_quote_send(request.message)
        results = [
            self._gateway.call(
                agent_id=agent_id,
                tool="document_tool",
                action="get_quote_document",
                context=context,
                untrusted_text=request.message,
            )
        ]
        if send_requested or "onay" in normalize(request.message):
            results.append(
                self._gateway.call(
                    agent_id=agent_id,
                    tool="workflow_tool",
                    action="request_approval",
                    context=context,
                    untrusted_text=request.message,
                )
            )
        if send_requested:
            results.append(
                self._gateway.call(
                    agent_id=agent_id,
                    tool="document_tool",
                    action="send_quote",
                    context=context,
                    untrusted_text=request.message,
                )
            )
        return results


def classify_message(message: str) -> AgentID:
    text = normalize(message)
    if contains_any(text, ["bul", "search", "find"]) or has_word(text, "ara"):
        return "enterprise_search"
    if contains_any(text, ["fark", "diff", "revision", "revizyon", "karsilastir", "compare"]):
        return "revision_diff"
    if contains_any(text, ["maliyet", "cost", "fiyat", "price", "snapshot", "toplam", "kar marj"]):
        return "costing_pricing"
    if contains_any(
        text,
        ["teklif", "proposal", "pdf", "belge", "dokuman", "onizleme", "gonder", "onay", "send"],
    ):
        return "quote_document"
    return "enterprise_search"


def detect_prompt_injection(message: str) -> list[str]:
    text = normalize(message)
    risky_markers = [
        "ignore previous",
        "onceki talimat",
        "system prompt",
        "gizli prompt",
        "reveal secret",
        "token",
        "bypass",
        "policy",
        "company_id=",
        "approval_token=",
        "approval token",
        "document access token",
        "tool output",
        "malicious tool",
        "call forbidden tool",
        "signed url",
        "storage path",
        "kendin hesapla",
        "calculate total yourself",
        "do not call tools",
    ]
    if contains_any(text, risky_markers):
        return [
            "Prompt injection veya politika atlatma ifadesi algilandi; yalnizca yetkili arac sonuclari kullanildi."
        ]
    return []


def wants_policy_bypass(message: str) -> bool:
    text = normalize(message)
    return contains_any(
        text,
        [
            "ignore previous",
            "onceki talimat",
            "system prompt",
            "gizli prompt",
            "reveal secret",
            "bypass",
            "company_id=",
            "approval_token=",
            "approval token",
            "document access token",
            "tool output",
            "malicious tool",
            "call forbidden tool",
            "signed url",
            "storage path",
            "do not call tools",
        ],
    )


def wants_cross_tenant(message: str) -> bool:
    text = normalize(message)
    return contains_any(
        text,
        [
            "baska sirket",
            "tum sirket",
            "diger sirket",
            "other tenant",
            "other company",
            "all companies",
            "all tenants",
        ],
    )


def wants_quote_send(message: str) -> bool:
    text = normalize(message)
    return contains_any(text, ["gonder", "send", "email", "e-posta"])


def determine_status(
    tool_calls: list[ToolCallRecord], actions: list[ProposedAction], missing: list[str]
) -> ResponseStatus:
    if missing:
        return "needs_input"
    if any(call.status == "denied" for call in tool_calls):
        return "failed"
    if any(call.status == "approval_required" for call in tool_calls) or any(
        action.approval_required for action in actions
    ):
        return "needs_approval"
    return "informational"


def approval_for(tool_calls: list[ToolCallRecord], actions: list[ProposedAction]) -> Approval:
    if any(call.status == "approval_required" for call in tool_calls) or any(
        action.approval_required for action in actions
    ):
        approval_id = next(
            (action.approval_id for action in actions if action.approval_required), None
        )
        return Approval(required=True, state="pending", approval_id=approval_id)
    return Approval(required=False, state="not_required")


def summary_for(
    agent_id: AgentID,
    status: ResponseStatus,
    facts: list[Fact],
    actions: list[ProposedAction],
    warnings: list[str],
    missing: list[str],
) -> str:
    if missing:
        return "Devam etmek icin eksik baglam gerekli: " + ", ".join(missing)
    if status == "failed":
        return "Istek politika veya yetki denetiminden gecmedi."
    if agent_id == "costing_pricing":
        return "Maliyet snapshot sonucu, deterministic costing_tool ciktisina dayanarak aciklandi."
    if agent_id == "revision_diff":
        return "Iki revizyon arasindaki farklar yetkili diff araclarindan okundu."
    if agent_id == "quote_document" and actions:
        return "Teklif onizleme hazirlandi; gonderim icin onay sureci ayrica bekliyor."
    if warnings and not facts:
        return "Istek guvenlik uyarilariyla sinirlandirildi."
    return "Yetkili araclardan bulunan proje ve teklif bilgileri listelendi."


def format_money(value: MoneyMinor) -> str:
    major = value.amount_minor // 100
    minor = abs(value.amount_minor) % 100
    return f"{major}.{minor:02d} {value.currency}"


def normalize(message: str) -> str:
    replacements = {
        "\u0130": "i",
        "\u0131": "i",
        "\u015f": "s",
        "\u015e": "s",
        "\u011f": "g",
        "\u011e": "g",
        "\u00fc": "u",
        "\u00dc": "u",
        "\u00f6": "o",
        "\u00d6": "o",
        "\u00e7": "c",
        "\u00c7": "c",
        "I": "i",
    }
    text = message
    for original, replacement in replacements.items():
        text = text.replace(original, replacement)
    return text.lower()


def contains_any(text: str, needles: list[str]) -> bool:
    return any(needle in text for needle in needles)


def has_word(text: str, word: str) -> bool:
    return f" {word} " in f" {text} "


def repository_root() -> Path:
    return Path(__file__).resolve().parents[3]
