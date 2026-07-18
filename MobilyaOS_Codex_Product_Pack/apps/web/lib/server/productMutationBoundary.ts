export type TrustedMutationScope = {
  appUserId: string;
  role: "admin" | "sales" | "viewer" | string;
  companyId: string;
};

export type PlannedMutationKind =
  | "create_customer"
  | "create_project"
  | "create_quote_revision_draft"
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
  "create_quote_revision_draft"
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

  if (kind === "read_quote_revision" || kind === "list_project_quote_revisions") {
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
        ? "Low-risk draft mutation may proceed through tenant-scoped repository methods."
        : "Viewer and non-writer roles cannot create customer, project, or quote draft records."
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
