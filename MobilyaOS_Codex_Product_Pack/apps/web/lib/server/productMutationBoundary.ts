export type TrustedMutationScope = {
  appUserId: string;
  role: "admin" | "sales" | "viewer" | string;
  companyId: string;
};

export type PlannedMutationKind =
  | "create_customer"
  | "create_project"
  | "create_quote_revision_draft"
  | "create_quote_configuration_draft"
  | "update_quote_configuration_draft"
  | "calculate_quote_snapshot"
  | "generate_frozen_quote_document"
  | "fork_quote_revision"
  | "prepare_quote_approval_token"
  | "generate_quote_artifact"
  | "generate_quote_pdf_artifact"
  | "read_quote_document"
  | "read_quote_artifact"
  | "read_revision_diff"
  | "read_approval_status"
  | "read_send_gate_status"
  | "read_quote_send_intent"
  | "prepare_quote_send_intent"
  | "read_quote_delivery_outbox"
  | "prepare_quote_delivery_outbox"
  | "read_quote_revision"
  | "list_project_quote_revisions"
  | "append_audit_entry"
  | "quote_send"
  | "quote_approve"
  | "generate_customer_document"
  | "create_production_package";

export type MutationBoundaryDecision = {
  kind: PlannedMutationKind;
  allowed: boolean;
  status: "allowed_read" | "allowed_mutation" | "deferred" | "approval_required" | "denied";
  reason: string;
};

const writerRoles = new Set(["admin", "sales"]);
const approvalRoles = new Set(["admin"]);
const activeMutationKinds = new Set<PlannedMutationKind>([
  "create_customer",
  "create_project",
  "create_quote_revision_draft",
  "create_quote_configuration_draft",
  "update_quote_configuration_draft",
  "calculate_quote_snapshot",
  "generate_frozen_quote_document",
  "generate_quote_artifact",
  "generate_quote_pdf_artifact",
  "prepare_quote_send_intent",
  "prepare_quote_delivery_outbox",
  "fork_quote_revision"
]);

function hasTrustedScope(scope: TrustedMutationScope): boolean {
  return Boolean(scope.appUserId && scope.companyId && scope.role);
}

export function planProductMutationBoundary(
  scope: TrustedMutationScope,
  kind: PlannedMutationKind
): MutationBoundaryDecision {
  if (!hasTrustedScope(scope)) {
    return {
      kind,
      allowed: false,
      status: "denied",
      reason: "A trusted server-side session scope is required."
    };
  }

  if (
    kind === "read_quote_revision" ||
    kind === "list_project_quote_revisions" ||
    kind === "read_quote_document" ||
    kind === "read_quote_artifact" ||
    kind === "read_revision_diff" ||
    kind === "read_approval_status" ||
    kind === "read_send_gate_status" ||
    kind === "read_quote_send_intent" ||
    kind === "read_quote_delivery_outbox"
  ) {
    return {
      kind,
      allowed: true,
      status: "allowed_read",
      reason: "Read access may proceed only through tenant-scoped repository methods."
    };
  }

  if (activeMutationKinds.has(kind)) {
    return {
      kind,
      allowed: writerRoles.has(scope.role),
      status: writerRoles.has(scope.role) ? "allowed_mutation" : "denied",
      reason: writerRoles.has(scope.role)
        ? "Reviewed draft/artifact/PDF/outbox/send-intent mutation may proceed through tenant-scoped repository methods."
        : "Viewer and non-writer roles cannot create customer, project, quote draft, quote configuration draft, quote calculation snapshot, frozen document, stored artifact, PDF artifact, delivery outbox, send-intent, or fork records."
    };
  }

  if (kind === "prepare_quote_approval_token") {
    return {
      kind,
      allowed: approvalRoles.has(scope.role),
      status: approvalRoles.has(scope.role) ? "allowed_mutation" : "denied",
      reason: approvalRoles.has(scope.role)
        ? "Approval gate preparation may proceed without approving or sending the quote."
        : "Approval-token preparation is limited to admin in this sprint."
    };
  }

  if (kind === "append_audit_entry") {
    return {
      kind,
      allowed: true,
      status: "allowed_mutation",
      reason: "Audit append is allowed only as a server-side side effect of an authorized action."
    };
  }

  if (kind === "quote_send" || kind === "quote_approve") {
    return {
      kind,
      allowed: false,
      status: approvalRoles.has(scope.role) ? "approval_required" : "denied",
      reason: "Quote approval/send requires a durable backend approval workflow before activation."
    };
  }

  if (kind === "generate_customer_document" || kind === "create_production_package") {
    return {
      kind,
      allowed: false,
      status: "approval_required",
      reason: "Customer documents and production packages require deterministic backend generation and approval gates."
    };
  }

  return {
    kind,
    allowed: false,
    status: writerRoles.has(scope.role) ? "deferred" : "denied",
    reason: "This write path is intentionally prepared but not activated in the session-boundary sprint."
  };
}
