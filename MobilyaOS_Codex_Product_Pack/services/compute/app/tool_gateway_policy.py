from __future__ import annotations

from typing import Literal, Sequence

from pydantic import BaseModel


DEMO_COMPANY_ID = "11111111-1111-4111-8111-111111111111"

ToolMode = Literal["read", "mutation", "workflow", "conversation", "forbidden"]
DecisionStatus = Literal["allowed", "denied", "approval_required"]


class ToolPolicy(BaseModel):
    name: str
    adapter_tool: str
    adapter_action: str
    mode: ToolMode
    allowed_agents: tuple[str, ...]
    allowed_roles: tuple[str, ...]
    requires_session: bool
    requires_tenant: bool
    requires_audit: bool
    requires_idempotency: bool
    requires_approval: bool
    requires_draft_revision: bool = False
    requires_expected_version: bool = False
    fixed_calculation_status: Literal["not_calculated"] | None = None
    executable: bool
    llm_authoritative_calculation: Literal[False] = False


class ToolPolicyManifest(BaseModel):
    version: str
    direct_database_access: Literal[False]
    service_key_access: Literal[False]
    llm_authoritative_calculation: Literal[False]
    policies: list[ToolPolicy]


class ToolPolicyDecision(BaseModel):
    tool_name: str
    allowed: bool
    status: DecisionStatus
    reason: str
    requires_audit: bool
    requires_idempotency: bool
    requires_approval: bool
    warnings: list[str]


def _policy(
    name: str,
    adapter_tool: str,
    adapter_action: str,
    mode: ToolMode,
    allowed_agents: tuple[str, ...],
    allowed_roles: tuple[str, ...],
    *,
    requires_audit: bool = True,
    requires_idempotency: bool = False,
    requires_approval: bool = False,
    requires_draft_revision: bool = False,
    requires_expected_version: bool = False,
    fixed_calculation_status: Literal["not_calculated"] | None = None,
    executable: bool = True,
) -> ToolPolicy:
    return ToolPolicy(
        name=name,
        adapter_tool=adapter_tool,
        adapter_action=adapter_action,
        mode=mode,
        allowed_agents=allowed_agents,
        allowed_roles=allowed_roles,
        requires_session=True,
        requires_tenant=True,
        requires_audit=requires_audit,
        requires_idempotency=requires_idempotency,
        requires_approval=requires_approval,
        requires_draft_revision=requires_draft_revision,
        requires_expected_version=requires_expected_version,
        fixed_calculation_status=fixed_calculation_status,
        executable=executable,
    )


READ_ROLES = ("admin", "sales", "designer", "costing", "procurement", "production", "viewer")
WRITER_ROLES = ("admin", "sales")
QUOTE_ROLES = ("admin", "sales", "costing")

TOOL_POLICIES: tuple[ToolPolicy, ...] = (
    _policy(
        "list_customers",
        "project_tool",
        "list_customers",
        "read",
        ("enterprise_search",),
        READ_ROLES,
    ),
    _policy("list_projects", "project_tool", "search", "read", ("enterprise_search",), READ_ROLES),
    _policy(
        "search_proposals", "document_tool", "search", "read", ("enterprise_search",), READ_ROLES
    ),
    _policy(
        "list_quote_revisions",
        "project_tool",
        "list_quote_revisions",
        "read",
        ("enterprise_search", "revision_diff", "quote_document"),
        READ_ROLES,
    ),
    _policy(
        "get_quote_revision",
        "project_tool",
        "get_revision",
        "read",
        ("enterprise_search", "revision_diff", "quote_document", "costing_pricing"),
        READ_ROLES,
    ),
    _policy(
        "get_quote_configuration_draft",
        "project_tool",
        "get_quote_configuration_draft",
        "read",
        ("quote_document", "revision_diff"),
        READ_ROLES,
    ),
    _policy(
        "validate_configuration_draft",
        "calculation_tool",
        "validate_configuration_draft",
        "read",
        ("quote_document", "costing_pricing"),
        ("admin", "sales", "designer", "costing"),
    ),
    _policy(
        "calculate_quote_snapshot",
        "calculation_tool",
        "calculate_quote_snapshot",
        "mutation",
        ("quote_document", "costing_pricing"),
        ("admin", "sales", "costing"),
        requires_idempotency=True,
        requires_draft_revision=True,
        requires_expected_version=True,
        executable=False,
    ),
    _policy(
        "get_quote_snapshot",
        "calculation_tool",
        "get_quote_snapshot",
        "read",
        ("costing_pricing", "quote_document", "revision_diff"),
        READ_ROLES,
    ),
    _policy(
        "explain_quote_snapshot",
        "calculation_tool",
        "explain_quote_snapshot",
        "conversation",
        ("costing_pricing", "quote_document"),
        READ_ROLES,
        requires_audit=False,
    ),
    _policy(
        "explain_quote_revision",
        "project_tool",
        "explain_quote_revision",
        "read",
        ("enterprise_search", "revision_diff", "quote_document"),
        READ_ROLES,
    ),
    _policy(
        "explain_cost_snapshot",
        "costing_tool",
        "get_cost_snapshot",
        "read",
        ("costing_pricing",),
        ("admin", "sales", "costing"),
    ),
    _policy(
        "get_quote_document",
        "document_tool",
        "get_quote_document",
        "read",
        ("quote_document",),
        READ_ROLES,
    ),
    _policy(
        "explain_quote_document",
        "document_tool",
        "explain_quote_document",
        "conversation",
        ("quote_document",),
        READ_ROLES,
        requires_audit=False,
    ),
    _policy(
        "explain_quote_artifact",
        "document_tool",
        "explain_quote_artifact",
        "conversation",
        ("quote_document",),
        READ_ROLES,
        requires_audit=False,
    ),
    _policy(
        "get_approval_status",
        "workflow_tool",
        "get_approval_status",
        "read",
        ("quote_document", "revision_diff"),
        READ_ROLES,
    ),
    _policy(
        "explain_approval_status",
        "workflow_tool",
        "explain_approval_status",
        "conversation",
        ("quote_document", "revision_diff"),
        READ_ROLES,
        requires_audit=False,
    ),
    _policy(
        "get_send_gate_status",
        "workflow_tool",
        "get_send_gate_status",
        "read",
        ("quote_document",),
        READ_ROLES,
    ),
    _policy(
        "explain_send_gate_status",
        "workflow_tool",
        "explain_send_gate_status",
        "conversation",
        ("quote_document",),
        READ_ROLES,
        requires_audit=False,
    ),
    _policy(
        "get_revision_diff",
        "manufacturing_tool",
        "get_revision_diff",
        "read",
        ("revision_diff",),
        READ_ROLES,
    ),
    _policy(
        "explain_revision_diff",
        "manufacturing_tool",
        "explain_revision_diff",
        "conversation",
        ("revision_diff",),
        READ_ROLES,
        requires_audit=False,
    ),
    _policy(
        "explain_cost_diff", "costing_tool", "cost_diff", "read", ("revision_diff",), READ_ROLES
    ),
    _policy(
        "explain_document_diff",
        "document_tool",
        "document_diff",
        "read",
        ("revision_diff",),
        READ_ROLES,
    ),
    _policy(
        "request_missing_measurement_info",
        "conversation_tool",
        "request_missing_measurement_info",
        "conversation",
        ("quote_document", "enterprise_search"),
        READ_ROLES,
        requires_audit=False,
    ),
    _policy(
        "create_customer_draft",
        "project_tool",
        "create_customer_draft",
        "mutation",
        ("enterprise_search", "quote_document"),
        WRITER_ROLES,
        requires_idempotency=True,
        executable=False,
    ),
    _policy(
        "create_project_draft",
        "project_tool",
        "create_project_draft",
        "mutation",
        ("enterprise_search", "quote_document"),
        WRITER_ROLES,
        requires_idempotency=True,
        executable=False,
    ),
    _policy(
        "create_quote_draft",
        "project_tool",
        "create_quote_draft",
        "mutation",
        ("quote_document",),
        WRITER_ROLES,
        requires_idempotency=True,
        requires_draft_revision=True,
        fixed_calculation_status="not_calculated",
        executable=False,
    ),
    _policy(
        "create_quote_configuration_draft",
        "project_tool",
        "create_quote_configuration_draft",
        "mutation",
        ("quote_document",),
        WRITER_ROLES,
        requires_idempotency=True,
        requires_draft_revision=True,
        requires_expected_version=True,
        fixed_calculation_status="not_calculated",
        executable=False,
    ),
    _policy(
        "update_quote_configuration_draft",
        "project_tool",
        "update_quote_configuration_draft",
        "mutation",
        ("quote_document",),
        WRITER_ROLES,
        requires_idempotency=True,
        requires_draft_revision=True,
        requires_expected_version=True,
        fixed_calculation_status="not_calculated",
        executable=False,
    ),
    _policy(
        "request_quote_approval",
        "workflow_tool",
        "request_approval",
        "workflow",
        ("quote_document",),
        WRITER_ROLES,
        requires_idempotency=True,
        requires_draft_revision=True,
        requires_expected_version=True,
        executable=False,
    ),
    _policy(
        "send_quote",
        "document_tool",
        "send_quote",
        "forbidden",
        ("quote_document",),
        WRITER_ROLES,
        requires_idempotency=True,
        requires_approval=True,
        executable=False,
    ),
    _policy(
        "approve_quote",
        "document_tool",
        "approve_quote",
        "forbidden",
        ("quote_document",),
        ("admin",),
        requires_idempotency=True,
        requires_approval=True,
        executable=False,
    ),
    _policy(
        "approve_quote_from_chat",
        "document_tool",
        "approve_quote_from_chat",
        "forbidden",
        ("quote_document",),
        ("admin",),
        requires_idempotency=True,
        requires_approval=True,
        executable=False,
    ),
    _policy(
        "consume_approval_token_from_chat",
        "workflow_tool",
        "consume_approval_token",
        "forbidden",
        ("quote_document",),
        ("admin",),
        requires_idempotency=True,
        requires_approval=True,
        executable=False,
    ),
    _policy(
        "mutate_quote_from_chat",
        "document_tool",
        "mutate_quote_from_chat",
        "forbidden",
        ("quote_document", "costing_pricing", "revision_diff", "enterprise_search"),
        READ_ROLES,
        requires_idempotency=True,
        requires_approval=True,
        executable=False,
    ),
    _policy(
        "generate_pdf",
        "document_tool",
        "generate_pdf",
        "forbidden",
        ("quote_document",),
        WRITER_ROLES,
        requires_idempotency=True,
        requires_approval=True,
        executable=False,
    ),
    _policy(
        "create_production_package",
        "manufacturing_tool",
        "create_production_package",
        "forbidden",
        ("revision_diff",),
        ("admin", "production"),
        requires_idempotency=True,
        requires_approval=True,
        executable=False,
    ),
    _policy(
        "generate_production_package",
        "manufacturing_tool",
        "generate_production_package",
        "forbidden",
        ("revision_diff", "quote_document"),
        ("admin", "production"),
        requires_idempotency=True,
        requires_approval=True,
        executable=False,
    ),
    _policy(
        "run_authoritative_calculation_from_llm",
        "llm",
        "run_authoritative_calculation",
        "forbidden",
        ("costing_pricing", "revision_diff", "quote_document"),
        READ_ROLES,
        executable=False,
    ),
)

_POLICIES_BY_NAME = {policy.name: policy for policy in TOOL_POLICIES}


def tool_policy_manifest() -> ToolPolicyManifest:
    return ToolPolicyManifest(
        version="phase5-tool-gateway-skeleton-v1",
        direct_database_access=False,
        service_key_access=False,
        llm_authoritative_calculation=False,
        policies=list(TOOL_POLICIES),
    )


def get_tool_policy(name: str) -> ToolPolicy | None:
    return _POLICIES_BY_NAME.get(name)


def tool_policy_for_adapter(
    *, agent_id: str, adapter_tool: str, adapter_action: str
) -> ToolPolicy | None:
    for policy in TOOL_POLICIES:
        if (
            policy.adapter_tool == adapter_tool
            and policy.adapter_action == adapter_action
            and agent_id in policy.allowed_agents
        ):
            return policy
    return None


def detect_untrusted_policy_bypass(text: str | None) -> bool:
    if not text:
        return False
    normalized = text.casefold()
    markers = (
        "ignore previous instructions",
        "approval_token=",
        "storage_path",
        "signed_url",
        "signed url",
        "service_role",
        "database_url",
        "direct_database_url",
        "approval token",
        "document access token",
        "tool output",
        "malicious tool",
        "call forbidden tool",
        "bypass",
        "finalize quote",
        "consume approval",
        "recalculate",
        "calculate total",
        "tum sirket",
        "baska sirket",
        "all companies",
        "other companies",
    )
    return any(marker in normalized for marker in markers)


def evaluate_tool_request(
    *,
    agent_id: str,
    tool_name: str,
    roles: Sequence[str],
    company_id: str | None,
    session_present: bool,
    idempotency_key: str | None = None,
    approval_granted: bool = False,
    untrusted_text: str | None = None,
) -> ToolPolicyDecision:
    policy = get_tool_policy(tool_name)
    warnings: list[str] = []
    if detect_untrusted_policy_bypass(untrusted_text):
        warnings.append("prompt injection or policy bypass text ignored by gateway")
        return _decision(
            tool_name,
            policy,
            False,
            "denied",
            "untrusted text cannot grant tools or policy overrides",
            warnings,
        )
    if policy is None:
        return _decision(
            tool_name,
            None,
            False,
            "denied",
            "tool is not registered in the gateway policy",
            warnings,
        )
    if agent_id not in policy.allowed_agents:
        return _decision(
            tool_name, policy, False, "denied", "agent is not authorized for this tool", warnings
        )
    if not session_present:
        return _decision(
            tool_name,
            policy,
            False,
            "denied",
            "authenticated server-side session is required",
            warnings,
        )
    if policy.requires_tenant and company_id != DEMO_COMPANY_ID:
        return _decision(
            tool_name, policy, False, "denied", "trusted tenant scope is required", warnings
        )
    if set(roles).isdisjoint(policy.allowed_roles):
        return _decision(
            tool_name, policy, False, "denied", "role is not authorized for this tool", warnings
        )
    if policy.requires_idempotency and not idempotency_key:
        return _decision(
            tool_name, policy, False, "denied", "durable idempotency key is required", warnings
        )
    if not policy.executable:
        status: DecisionStatus = "approval_required" if policy.requires_approval else "denied"
        return _decision(
            tool_name,
            policy,
            False,
            status,
            "tool is registered but not executable in the current gateway",
            warnings,
        )
    if policy.requires_approval and not approval_granted:
        return _decision(
            tool_name,
            policy,
            False,
            "approval_required",
            "human approval is required before execution",
            warnings,
        )
    return _decision(
        tool_name, policy, True, "allowed", "tool request is allowed by gateway metadata", warnings
    )


def _decision(
    tool_name: str,
    policy: ToolPolicy | None,
    allowed: bool,
    status: DecisionStatus,
    reason: str,
    warnings: list[str],
) -> ToolPolicyDecision:
    return ToolPolicyDecision(
        tool_name=tool_name,
        allowed=allowed,
        status=status,
        reason=reason,
        requires_audit=policy.requires_audit if policy else False,
        requires_idempotency=policy.requires_idempotency if policy else False,
        requires_approval=policy.requires_approval if policy else False,
        warnings=warnings,
    )
