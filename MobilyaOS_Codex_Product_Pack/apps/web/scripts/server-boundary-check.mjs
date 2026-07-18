import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const forbidden = [
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "DIRECT_DATABASE_URL",
  "JWT_SECRET",
  "SESSION_ENCRYPTION_KEY",
  "database_password",
  "service_role",
  "signed_url",
  "storage_bucket",
  "storage_path",
  "token_hash",
  "artifact_html",
  "raw_storage_path"
];

const riskyRouteMethods = ["PUT", "PATCH", "DELETE"];
const riskyQuoteRouteMethods = ["POST", ...riskyRouteMethods];
const forbiddenRouteBodyAuthority = /\bbody\.(company_id|companyId|role|roles|tenant|tenant_id|user_id|actor_id|actor_app_user_id|auth_user_id|app_user_id|status|decision|metadata|created_at|approved_at|sent_at|storage_bucket|storage_path|raw_storage_path|cost_snapshot|diff_entries|approval_token|access_token|refresh_token|service_role|database_password)\b/i;

function walk(dir) {
  const entries = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (full.includes(`${join("node_modules")}`) || full.includes(`${join(".next")}`)) {
      continue;
    }
    const stat = statSync(full);
    if (stat.isDirectory()) {
      entries.push(...walk(full));
    } else if (/\.(js|jsx|ts|tsx)$/.test(name)) {
      entries.push(full);
    }
  }
  return entries;
}

function requireMarker(text, marker, message) {
  if (!text.includes(marker)) {
    violations.push(message);
  }
}

function requireNoMarker(text, marker, message) {
  if (text.includes(marker)) {
    violations.push(message);
  }
}

function requireNoRegex(text, pattern, message) {
  if (pattern.test(text)) {
    violations.push(message);
  }
}

function requireOrder(text, markers, message) {
  let cursor = -1;
  for (const marker of markers) {
    const index = text.indexOf(marker);
    if (index <= cursor) {
      violations.push(message);
      return;
    }
    cursor = index;
  }
}

function sourceBlock(text, name) {
  const patterns = [`export async function ${name}`, `export function ${name}`, `function ${name}`];
  const start = patterns.map((pattern) => text.indexOf(pattern)).find((index) => index >= 0);
  if (start === undefined) {
    violations.push(`${name} was not found for boundary inspection`);
    return "";
  }
  const nextExport = text.indexOf("\nexport ", start + 1);
  const nextFunction = text.indexOf("\nfunction ", start + 1);
  const endings = [nextExport, nextFunction].filter((index) => index > start);
  const end = endings.length ? Math.min(...endings) : text.length;
  return text.slice(start, end);
}

function textBlock(text, startMarker, endMarker, label) {
  const start = text.indexOf(startMarker);
  if (start < 0) {
    violations.push(`${label} was not found for boundary inspection`);
    return "";
  }
  const end = text.indexOf(endMarker, start + startMarker.length);
  return text.slice(start, end > start ? end : text.length);
}

function exportedMethods(text) {
  return [...text.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\b/g)].map((match) => match[1]);
}

function requireOnlyMethods(route, text, allowed) {
  const methods = exportedMethods(text);
  for (const method of methods) {
    if (!allowed.includes(method)) {
      violations.push(`${route} unexpectedly exports ${method}`);
    }
  }
  for (const method of allowed) {
    if (!methods.includes(method)) {
      violations.push(`${route} is missing expected ${method}`);
    }
  }
}

const clientFiles = walk(root).filter((file) => {
  const rel = relative(root, file).replaceAll("\\", "/");
  return (
    !rel.startsWith("app/api/") &&
    !rel.startsWith("lib/server/") &&
    rel !== "next-env.d.ts"
  );
});

const violations = [];
for (const file of clientFiles) {
  const text = readFileSync(file, "utf8");
  const rel = relative(root, file).replaceAll("\\", "/");
  if (!rel.startsWith("scripts/")) {
    for (const key of forbidden) {
      if (text.includes(key)) {
        violations.push(`${rel} references ${key}`);
      }
    }
  }
  if (!rel.startsWith("scripts/")) {
    requireNoMarker(text, "/api/v1/agent/chat", `${rel} must not call compute agent chat directly`);
    requireNoMarker(text, "NEXT_PUBLIC_COMPUTE_BASE_URL", `${rel} must not expose compute base URL to the browser`);
    requireNoMarker(text, "computeBaseUrl", `${rel} must not expose compute base URL to the browser`);
  }
}

const repositoryText = readFileSync(join(root, "lib/server/supabaseRepository.ts"), "utf8");
requireMarker(repositoryText, "company_id", "server repository does not show tenant-scope enforcement markers");
requireMarker(repositoryText, "assertCompanyScope", "server repository does not assert returned company scope");
requireMarker(repositoryText, "auth_user_id", "server repository does not map Supabase Auth users to app_users");
requireNoRegex(
  repositoryText,
  /generated_documents[\s\S]*?storage_bucket/,
  "public generated document DTO/query must not expose storage bucket metadata"
);
const approvalGateSelectBlock = textBlock(repositoryText, "const approvalGateSelect", "].join", "approvalGateSelect");
requireNoMarker(approvalGateSelectBlock, "token_hash", "approval gate select must not expose token hashes");
const generatedDocumentRecordBlock = textBlock(repositoryText, "export type GeneratedDocumentRecord", "export type ApprovalRecord", "GeneratedDocumentRecord");
requireNoRegex(generatedDocumentRecordBlock, /(storage_bucket|storage_path|signed_url)/, "public generated document type must not expose storage locators");
requireNoRegex(
  repositoryText,
  /\b(company_id|actor_app_user_id|decision|status)\s*:\s*input\./,
  "server repository appears to trust caller input for tenant, actor, decision, or status authority"
);

const sessionText = readFileSync(join(root, "lib/server/session.ts"), "utf8");
if (!sessionText.includes("aes-256-gcm") || !sessionText.includes("httpOnly: true") || !sessionText.includes("expires_at")) {
  violations.push("server session boundary does not show encrypted HTTP-only expiring cookie markers");
}

const sessionContextText = readFileSync(join(root, "lib/server/sessionContext.ts"), "utf8");
requireMarker(sessionContextText, "loadAppUserContext(claims.app_user_id, claims.company_id)", "session context does not reload app user mapping from the server repository");
requireMarker(sessionContextText, "role: mapped.app_user.role", "mutation scope role must come from the app user mapping, not only cookie claims");
requireNoMarker(sessionContextText, "role: claims.role", "mutation scope must not trust the role value stored in the session cookie");

const loginRouteText = readFileSync(join(root, "app/api/supabase/demo-login/route.ts"), "utf8");
if (!loginRouteText.includes("response.cookies.set") || loginRouteText.includes("session_persisted: false")) {
  violations.push("demo-login route does not persist the HTTP-only session cookie");
}

const demoDataRouteText = readFileSync(join(root, "app/api/supabase/demo-data/route.ts"), "utf8");
if (
  !demoDataRouteText.includes("resolveAuthenticatedSession") ||
  !demoDataRouteText.includes("session.claims.company_id") ||
  demoDataRouteText.includes("loadDemoTenantOverview()")
) {
  violations.push("demo-data route is not clearly scoped by the authenticated session company");
}

const mutationBoundaryText = readFileSync(join(root, "lib/server/productMutationBoundary.ts"), "utf8");
for (const marker of ["TrustedMutationScope", "quote_send", "quote_approve", "create_production_package", "approval_required", "allowed_mutation"]) {
  requireMarker(mutationBoundaryText, marker, `server mutation boundary is missing ${marker}`);
}
requireMarker(mutationBoundaryText, "read_send_gate_status", "server mutation boundary must register read_send_gate_status as read-only");
const activeMutationMatch = mutationBoundaryText.match(/activeMutationKinds[\s\S]*?\(\[([\s\S]*?)\]\)/);
const activeMutationText = activeMutationMatch ? activeMutationMatch[1] : "";
for (const riskyKind of ["quote_send", "quote_approve", "generate_customer_document", "create_production_package"]) {
  if (activeMutationText.includes(riskyKind)) {
    violations.push(`server mutation boundary accidentally activates risky action ${riskyKind}`);
  }
}
requireMarker(mutationBoundaryText, 'writerRoles = new Set(["admin", "sales"])', "writer role set must stay limited to admin and sales");

const routeGuardsText = readFileSync(join(root, "lib/server/routeGuards.ts"), "utf8");
requireMarker(routeGuardsText, "requireMutationRequestSafety(request, session, action)", "mutation guard must enforce same-origin/rate-limit request safety");
requireOrder(
  routeGuardsText,
  ["const session = await requireSession(request)", "const boundary = requireBoundary(session, kind)", "const parsed = (await request.json())", "await reserveIdempotency"],
  "mutation guard must authenticate and authorize before parsing payload and reserving idempotency"
);

const requestSecurityText = readFileSync(join(root, "lib/server/requestSecurity.ts"), "utf8");
for (const marker of [
  "requireSameOriginMutation",
  "sec-fetch-site",
  "origin",
  "referer",
  "requireRateLimit",
  "createHash(\"sha256\")",
  "requireApprovalTokenConsumeRateLimit"
]) {
  requireMarker(requestSecurityText, marker, `request security helper is missing ${marker}`);
}
for (const marker of [
  "idempotencyKeyFromRequest(request, body)",
  "companyId: session.mutationScope.companyId",
  "appUserId: session.mutationScope.appUserId",
  "action,",
  "body",
  "await storeIdempotencyResult"
]) {
  requireMarker(routeGuardsText, marker, `idempotency guard is missing scoped marker ${marker}`);
}

const idempotencyText = readFileSync(join(root, "lib/server/idempotency.ts"), "utf8");
for (const marker of [
  "rpc/reserve_idempotency_record",
  "p_idempotency_key_hash: hashText(input.key)",
  "p_request_hash: requestHash",
  "durable_supabase_scoped",
  "idempotency_records?",
  "sanitizeStoredValue"
]) {
  requireMarker(idempotencyText, marker, `durable idempotency implementation is missing ${marker}`);
}
requireNoMarker(idempotencyText, "cache = new Map", "idempotency must not use process-local memory as the durable store");

const p7MigrationText = readFileSync(join(root, "..", "..", "supabase/migrations/0008_quote_document_revision_approval_gate.sql"), "utf8");
for (const marker of [
  '"tenant generated_documents no direct read"',
  '"tenant approvals no direct read"',
  "persist_frozen_quote_document",
  "fork_quote_revision_with_idempotency",
  "prepare_quote_approval_gate_with_idempotency",
  "revoke all on function public.persist_frozen_quote_document",
  "revoke all on function public.fork_quote_revision_with_idempotency",
  "revoke all on function public.prepare_quote_approval_gate_with_idempotency",
  "to service_role"
]) {
  requireMarker(p7MigrationText, marker, `P7 migration is missing security marker ${marker}`);
}

const p8MigrationText = readFileSync(join(root, "..", "..", "supabase/migrations/0009_approval_consumption_and_artifact_hardening.sql"), "utf8");
for (const marker of [
  "consume_quote_approval_token",
  "approval_consumption_version",
  "idx_approvals_token_hash_unique",
  "quote_status_changed",
  "quote_send_triggered",
  "production_package_triggered",
  "quote_approval_token_consumed",
  "grant execute on function public.consume_quote_approval_token",
  "to service_role"
]) {
  requireMarker(p8MigrationText, marker, `P8 migration is missing security marker ${marker}`);
}

const p9MigrationText = readFileSync(join(root, "..", "..", "supabase/migrations/0010_customer_approval_finalization_send_gate.sql"), "utf8");
for (const marker of [
  "consume_quote_approval_token",
  "enforce_quote_html_document_draft_revision",
  "trg_generated_documents_quote_html_draft",
  "set_config('app.mobilyaos_allow_quote_status_update', 'on', true)",
  "status = 'approved'",
  "version = version + 1",
  "quote_approved",
  "quote_approval_token_replayed",
  "quote_status_changed', true",
  "quote_send_triggered', false",
  "production_package_triggered', false",
  "revoke all on function public.consume_quote_approval_token",
  "to service_role"
]) {
  requireMarker(p9MigrationText, marker, `P9 migration is missing approval-finalization marker ${marker}`);
}

const mutationRouteChecks = [
  ["app/api/supabase/customers/route.ts", ["GET", "POST"], ["withMutationSession", "create_customer", "appendAuditEntry", "customer_created"]],
  ["app/api/supabase/projects/route.ts", ["GET", "POST"], ["withMutationSession", "create_project", "appendAuditEntry", "project_created"]],
  ["app/api/supabase/projects/[projectId]/route.ts", ["GET"], ["withReadSession", "getProjectDetail"]],
  ["app/api/supabase/projects/[projectId]/quote-drafts/route.ts", ["POST"], ["withMutationSession", "create_quote_revision_draft", "appendAuditEntry", "quote_draft_created", "deferred_actions"]],
  ["app/api/supabase/projects/[projectId]/quote-revisions/route.ts", ["GET"], ["withReadSession", "listQuoteRevisions"]],
  ["app/api/supabase/quote-revisions/[quoteRevisionId]/route.ts", ["GET"], ["withReadSession", "getQuoteRevisionDetail"]],
  ["app/api/supabase/quote-revisions/[quoteRevisionId]/configuration-draft/route.ts", ["GET", "POST", "PATCH"], ["withReadSession", "withMutationSession", "create_quote_configuration_draft", "update_quote_configuration_draft", "appendAuditEntry", "quote_configuration_created", "quote_configuration_updated", "not_calculated"]],
  ["app/api/supabase/quote-revisions/[quoteRevisionId]/calculate/route.ts", ["POST"], ["requireSession", "requireBoundary", "requireMutationRequestSafety", "calculate_quote_snapshot", "rejectBrowserAuthority", "expected_configuration_version", "reserveIdempotency", "quote_snapshot_calculated", "calculateWardrobeQuoteSnapshot", "persistQuoteCalculationResult"]],
  ["app/api/supabase/quote-revisions/[quoteRevisionId]/snapshot/route.ts", ["GET"], ["withReadSession", "getQuoteSnapshot"]],
  ["app/api/supabase/quote-revisions/[quoteRevisionId]/documents/route.ts", ["GET", "POST"], ["requireSession", "requireBoundary", "requireMutationRequestSafety", "read_quote_document", "generate_frozen_quote_document", "listQuoteDocuments", "generateQuoteDocument", "reserveIdempotency", "quote_document_generated", "rejectBrowserAuthority"]],
  ["app/api/supabase/documents/[documentId]/route.ts", ["GET"], ["requireSession", "requireBoundary", "read_quote_document", "getQuoteDocument"]],
  ["app/api/supabase/documents/[documentId]/preview/route.ts", ["GET"], ["requireSession", "requireBoundary", "read_quote_document", "getQuoteDocumentArtifact", "Content-Security-Policy", "no-store", "nosniff"]],
  ["app/api/supabase/quote-revisions/[quoteRevisionId]/fork/route.ts", ["POST"], ["requireSession", "requireBoundary", "requireMutationRequestSafety", "fork_quote_revision", "expected_revision_version", "forkQuoteRevision", "reserveIdempotency", "quote_revision_forked", "rejectBrowserAuthority"]],
  ["app/api/supabase/quote-revisions/[quoteRevisionId]/diff/route.ts", ["GET"], ["requireSession", "requireBoundary", "read_revision_diff", "getQuoteRevisionDiff", "against", "rejectUnsupportedQuery"]],
  ["app/api/supabase/quote-revisions/[quoteRevisionId]/approval-status/route.ts", ["GET"], ["requireSession", "requireBoundary", "read_approval_status", "getApprovalGateStatus"]],
  ["app/api/supabase/quote-revisions/[quoteRevisionId]/send-gate/route.ts", ["GET"], ["requireSession", "requireBoundary", "read_send_gate_status", "getQuoteSendGateStatus"]],
  ["app/api/supabase/quote-revisions/[quoteRevisionId]/approval-token/route.ts", ["POST"], ["requireSession", "requireBoundary", "requireMutationRequestSafety", "prepare_quote_approval_token", "prepareApprovalGate", "reserveIdempotency", "quote_approval_gate_prepared", "rejectBrowserAuthority"]],
  ["app/api/supabase/approval-tokens/consume/route.ts", ["POST"], ["requireSameOriginMutation", "allowedBodyKeys", "requireApprovalTokenConsumeRateLimit", "consumeApprovalToken", "token_secret_returned", "quote_status_changed", "quote_send_triggered", "production_package_triggered"]],
  ["app/api/supabase/agent-chat/route.ts", ["POST"], ["withReadSession", "read_only_agent_gateway", "prompt_injection_blocked", "mutation_tool_blocked", "listProjects", "getProjectDetail", "getQuoteRevisionDetail", "getQuoteConfigurationDraft", "getQuoteSnapshot", "getApprovalGateStatus", "getQuoteSendGateStatus", "getQuoteDocument", "getQuoteRevisionDiff", "listQuoteDocuments"]]
];
for (const [route, allowedMethods, markers] of mutationRouteChecks) {
  const text = readFileSync(join(root, route), "utf8");
  requireOnlyMethods(route, text, allowedMethods);
  requireNoRegex(text, forbiddenRouteBodyAuthority, `${route} reads browser-supplied authority fields`);
  if (route.includes("agent-chat")) {
    requireNoMarker(text, "withMutationSession", "agent chat route must stay read-only in Phase 6");
    requireNoMarker(text, "appendAuditEntry", "agent chat route must not append audit while it is read-only");
    requireNoMarker(text, "reserveIdempotency", "agent chat route must not reserve idempotency while it is read-only");
    requireNoMarker(text, "storeIdempotencyResult", "agent chat route must not persist idempotency while it is read-only");
    requireNoMarker(text, "createCustomer", "agent chat route must not call mutating repository functions");
    requireNoMarker(text, "createProject", "agent chat route must not call mutating repository functions");
    requireNoMarker(text, "createQuoteDraft", "agent chat route must not call mutating repository functions");
    requireNoMarker(text, "createQuoteConfigurationDraft", "agent chat route must not call mutating repository functions");
    requireNoMarker(text, "updateQuoteConfigurationDraft", "agent chat route must not call mutating repository functions");
    requireNoMarker(text, 'risk: "high"', "agent chat route proposed action risk must match the shared schema");
  }
  const p7PostRoute = route.includes("/documents/route.ts") || route.includes("/fork/route.ts") || route.includes("/approval-token/route.ts");
  const riskyMethods = route.includes("calculate")
    ? ["GET", "PUT", "PATCH", "DELETE"]
    : p7PostRoute
      ? ["PUT", "PATCH", "DELETE"]
    : route.includes("snapshot")
      ? riskyQuoteRouteMethods
      : route.includes("diff") || route.includes("approval-status") || route.includes("documents/[documentId]")
        ? riskyQuoteRouteMethods
      : route.includes("configuration-draft")
    ? ["PUT", "DELETE"]
    : route.includes("quote-revisions/[quoteRevisionId]")
      ? riskyQuoteRouteMethods
      : riskyRouteMethods;
  for (const method of riskyMethods) {
    requireNoMarker(text, `export async function ${method}`, `${route} exposes risky ${method} action`);
  }
  for (const marker of markers) {
    if (!text.includes(marker)) {
      violations.push(`${route} is missing boundary marker ${marker}`);
    }
  }
}

const createCustomerBlock = sourceBlock(repositoryText, "createCustomer");
requireMarker(createCustomerBlock, "company_id: context.companyId", "createCustomer must write the server session company_id");
requireMarker(createCustomerBlock, "assertCompanyScope([row], context.companyId", "createCustomer must assert returned row company scope");

const createProjectBlock = sourceBlock(repositoryText, "createProject");
requireMarker(createProjectBlock, "company_id: `eq.${context.companyId}`", "createProject must verify customer ownership in the session company");
requireMarker(createProjectBlock, "company_id: context.companyId", "createProject must write the server session company_id");
requireMarker(createProjectBlock, 'status: "draft"', "createProject must force draft status");
requireMarker(createProjectBlock, "assertCompanyScope([row], context.companyId", "createProject must assert returned row company scope");

const listQuoteRevisionsBlock = sourceBlock(repositoryText, "listQuoteRevisions");
requireMarker(listQuoteRevisionsBlock, "await requireProjectInCompany(context, trustedProjectId)", "listQuoteRevisions must verify project ownership before listing children");
requireMarker(listQuoteRevisionsBlock, "company_id: `eq.${context.companyId}`", "listQuoteRevisions must filter by session company_id");
requireMarker(listQuoteRevisionsBlock, "project_id: `eq.${trustedProjectId}`", "listQuoteRevisions must filter by trusted project id");

const getQuoteRevisionBlock = sourceBlock(repositoryText, "getQuoteRevision");
requireMarker(getQuoteRevisionBlock, "id: `eq.${trustedRevisionId}`", "getQuoteRevision must filter by trusted revision id");
requireMarker(getQuoteRevisionBlock, "company_id: `eq.${context.companyId}`", "getQuoteRevision must filter by session company_id");
requireMarker(getQuoteRevisionBlock, "assertCompanyScope(rows, context.companyId", "getQuoteRevision must assert returned row company scope");

const createQuoteDraftBlock = sourceBlock(repositoryText, "createQuoteDraft");
requireMarker(createQuoteDraftBlock, "await requireProjectInCompany(context, projectId)", "createQuoteDraft must verify project ownership before creating a child revision");
requireMarker(createQuoteDraftBlock, "company_id: `eq.${context.companyId}`", "createQuoteDraft must count existing revisions in the session company");
requireMarker(createQuoteDraftBlock, "company_id: context.companyId", "createQuoteDraft must write the server session company_id");
requireMarker(createQuoteDraftBlock, 'status: "draft"', "createQuoteDraft must force draft status");
requireMarker(createQuoteDraftBlock, "assertCompanyScope([row], context.companyId", "createQuoteDraft must assert returned row company scope");

const getQuoteConfigurationDraftBlock = sourceBlock(repositoryText, "getQuoteConfigurationDraft");
requireMarker(getQuoteConfigurationDraftBlock, "const quoteRevision = await getQuoteRevision(context, quoteRevisionId)", "getQuoteConfigurationDraft must resolve revision through session company");
requireMarker(getQuoteConfigurationDraftBlock, "company_id: `eq.${context.companyId}`", "getQuoteConfigurationDraft must filter by session company_id");
requireMarker(getQuoteConfigurationDraftBlock, "quote_revision_id: `eq.${quoteRevision.id}`", "getQuoteConfigurationDraft must filter by trusted revision id");
requireMarker(getQuoteConfigurationDraftBlock, "assertCompanyScope(rows, context.companyId", "getQuoteConfigurationDraft must assert returned row company scope");

const createQuoteConfigurationDraftBlock = sourceBlock(repositoryText, "createQuoteConfigurationDraft");
requireMarker(createQuoteConfigurationDraftBlock, "const quoteRevision = await getQuoteRevision(context, quoteRevisionId)", "createQuoteConfigurationDraft must resolve revision through session company");
requireMarker(createQuoteConfigurationDraftBlock, 'quoteRevision.status !== "draft"', "createQuoteConfigurationDraft must reject non-draft revisions");
requireMarker(createQuoteConfigurationDraftBlock, "configurationValuesFromInput(input)", "createQuoteConfigurationDraft must validate and sanitize configuration input");
requireMarker(createQuoteConfigurationDraftBlock, "company_id: context.companyId", "createQuoteConfigurationDraft must write the server session company_id");
requireMarker(createQuoteConfigurationDraftBlock, 'calculation_status: "not_calculated"', "createQuoteConfigurationDraft must not persist calculated state");
requireMarker(createQuoteConfigurationDraftBlock, "created_by: context.appUserId", "createQuoteConfigurationDraft must write trusted creator");
requireMarker(createQuoteConfigurationDraftBlock, "assertCompanyScope([row], context.companyId", "createQuoteConfigurationDraft must assert returned row company scope");

const updateQuoteConfigurationDraftBlock = sourceBlock(repositoryText, "updateQuoteConfigurationDraft");
requireMarker(updateQuoteConfigurationDraftBlock, "const quoteRevision = await getQuoteRevision(context, quoteRevisionId)", "updateQuoteConfigurationDraft must resolve revision through session company");
requireMarker(updateQuoteConfigurationDraftBlock, 'quoteRevision.status !== "draft"', "updateQuoteConfigurationDraft must reject non-draft revisions");
requireMarker(updateQuoteConfigurationDraftBlock, "configurationValuesFromInput(input)", "updateQuoteConfigurationDraft must validate and sanitize configuration input");
requireMarker(updateQuoteConfigurationDraftBlock, "company_id: `eq.${context.companyId}`", "updateQuoteConfigurationDraft must filter by session company_id");
requireMarker(updateQuoteConfigurationDraftBlock, 'calculation_status: "not_calculated"', "updateQuoteConfigurationDraft must not persist calculated state");
requireMarker(updateQuoteConfigurationDraftBlock, "updated_by: context.appUserId", "updateQuoteConfigurationDraft must write trusted updater");
requireMarker(updateQuoteConfigurationDraftBlock, "assertCompanyScope([row], context.companyId", "updateQuoteConfigurationDraft must assert returned row company scope");

const getQuoteSnapshotBlock = sourceBlock(repositoryText, "getQuoteSnapshot");
requireMarker(getQuoteSnapshotBlock, "const quoteRevision = await getQuoteRevision(context, quoteRevisionId)", "getQuoteSnapshot must resolve revision through session company");
requireMarker(getQuoteSnapshotBlock, "company_id: `eq.${context.companyId}`", "getQuoteSnapshot must filter snapshots by session company_id");
requireMarker(getQuoteSnapshotBlock, "revision_id: `eq.${quoteRevision.id}`", "getQuoteSnapshot must filter snapshots by trusted revision id");
requireMarker(getQuoteSnapshotBlock, "assertCompanyScope(bomRows, context.companyId", "getQuoteSnapshot must assert BOM company scope");
requireMarker(getQuoteSnapshotBlock, "assertCompanyScope(costRows, context.companyId", "getQuoteSnapshot must assert cost company scope");

const persistQuoteCalculationResultBlock = sourceBlock(repositoryText, "persistQuoteCalculationResult");
requireMarker(persistQuoteCalculationResultBlock, "rpc/persist_quote_calculation_result", "persistQuoteCalculationResult must use the atomic persistence RPC");
requireMarker(persistQuoteCalculationResultBlock, "p_company_id: context.companyId", "persistQuoteCalculationResult must use trusted company scope");
requireMarker(persistQuoteCalculationResultBlock, "p_actor_app_user_id: context.appUserId", "persistQuoteCalculationResult must use trusted actor scope");
requireMarker(persistQuoteCalculationResultBlock, "p_idempotency_record_id: reservation.id", "persistQuoteCalculationResult must bind durable idempotency");
requireMarker(persistQuoteCalculationResultBlock, "p_request_hash: reservation.requestHash", "persistQuoteCalculationResult must bind request hash");

const generateQuoteDocumentBlock = sourceBlock(repositoryText, "generateQuoteDocument");
requireMarker(generateQuoteDocumentBlock, "getCurrentCalculatedQuoteSnapshot", "generateQuoteDocument must require a current trusted snapshot");
requireMarker(generateQuoteDocumentBlock, 'snapshot.quote_revision.status !== "draft"', "generateQuoteDocument must reject non-draft revisions");
requireMarker(generateQuoteDocumentBlock, "buildFrozenQuoteHtmlDocument", "generateQuoteDocument must build frozen HTML server-side");
requireMarker(generateQuoteDocumentBlock, "rpc/persist_frozen_quote_document", "generateQuoteDocument must use the atomic document RPC");
requireMarker(generateQuoteDocumentBlock, "p_idempotency_record_id: reservation.id", "generateQuoteDocument must bind durable idempotency");
requireMarker(generateQuoteDocumentBlock, "p_request_hash: reservation.requestHash", "generateQuoteDocument must bind request hash");
requireMarker(generateQuoteDocumentBlock, "p_actor_app_user_id: context.appUserId", "generateQuoteDocument must use trusted actor scope");

const forkQuoteRevisionBlock = sourceBlock(repositoryText, "forkQuoteRevision");
requireMarker(forkQuoteRevisionBlock, "rpc/fork_quote_revision_with_idempotency", "forkQuoteRevision must use the atomic fork RPC");
requireMarker(forkQuoteRevisionBlock, "p_expected_revision_version: expectedRevisionVersion", "forkQuoteRevision must bind expected source revision version");
requireMarker(forkQuoteRevisionBlock, "p_idempotency_record_id: reservation.id", "forkQuoteRevision must bind durable idempotency");
requireMarker(forkQuoteRevisionBlock, "p_request_hash: reservation.requestHash", "forkQuoteRevision must bind request hash");

const prepareApprovalGateBlock = sourceBlock(repositoryText, "prepareApprovalGate");
requireMarker(prepareApprovalGateBlock, "getCurrentCalculatedQuoteSnapshot", "prepareApprovalGate must require a current trusted snapshot");
requireMarker(prepareApprovalGateBlock, "buildApprovalTokenSecret", "prepareApprovalGate must create the token hash server-side");
requireMarker(prepareApprovalGateBlock, "rpc/prepare_quote_approval_gate_with_idempotency", "prepareApprovalGate must use the atomic approval-gate RPC");
requireMarker(prepareApprovalGateBlock, "p_token_hash: token.tokenHash", "prepareApprovalGate must pass only the token hash to persistence");
requireMarker(prepareApprovalGateBlock, "p_idempotency_record_id: reservation.id", "prepareApprovalGate must bind durable idempotency");
requireNoMarker(prepareApprovalGateBlock, "rawToken", "prepareApprovalGate must not expose a raw approval token");

const consumeApprovalTokenBlock = sourceBlock(repositoryText, "consumeApprovalToken");
requireMarker(consumeApprovalTokenBlock, "hashApprovalTokenSecret(cleaned)", "consumeApprovalToken must hash the raw token before persistence lookup");
requireMarker(consumeApprovalTokenBlock, "rpc/consume_quote_approval_token", "consumeApprovalToken must use the service-role-only consumption RPC");
requireMarker(consumeApprovalTokenBlock, "p_consumption_version", "consumeApprovalToken must bind an explicit consumption version");
requireNoMarker(consumeApprovalTokenBlock, "quote_revision_id:", "consumeApprovalToken must not return revision identifiers from the repository mapper");

const getQuoteSendGateStatusBlock = sourceBlock(repositoryText, "getQuoteSendGateStatus");
requireMarker(getQuoteSendGateStatusBlock, "const revision = await getQuoteRevision(context, quoteRevisionId)", "getQuoteSendGateStatus must resolve revision through session company");
requireMarker(getQuoteSendGateStatusBlock, "await getApprovalGateStatus(context, revision.id)", "getQuoteSendGateStatus must read sanitized approval gate status");
requireMarker(getQuoteSendGateStatusBlock, "eligible_to_send: false", "getQuoteSendGateStatus must keep send non-executable");
requireMarker(getQuoteSendGateStatusBlock, "email_provider_configured: false", "getQuoteSendGateStatus must keep email provider disabled");
requireMarker(getQuoteSendGateStatusBlock, "quote_send_triggered: false", "getQuoteSendGateStatus must not send quote");
requireMarker(getQuoteSendGateStatusBlock, "production_package_triggered: false", "getQuoteSendGateStatus must not create production package");

const quoteStatusPolicyBlock = sourceBlock(repositoryText, "quoteStatusPolicy");
requireMarker(quoteStatusPolicyBlock, "direct_status_update_allowed: false", "quote status policy must forbid browser direct status writes");
requireMarker(quoteStatusPolicyBlock, 'allowed_transitions: normalized === "draft" ? ["approval_token_consume:draft_to_approved"] : []', "quote status policy must expose only the P9 approval-token transition");
requireMarker(quoteStatusPolicyBlock, "quote_send", "quote status policy must keep quote send deferred or blocked");
requireMarker(quoteStatusPolicyBlock, "quote_approve", "quote status policy must keep quote approval deferred or blocked");
requireMarker(quoteStatusPolicyBlock, "mutable: normalized === \"draft\"", "quote status policy must make only draft revisions mutable");
requireMarker(quoteStatusPolicyBlock, "? status : \"unknown\"", "quote status policy must not normalize unknown statuses to mutable draft");
requireMarker(quoteStatusPolicyBlock, 'normalized === "approved"', "approved quote status policy must expose send/PDF/production as deferred only");
requireMarker(quoteStatusPolicyBlock, "[\"direct_status_update\", \"modify_revision\", \"quote_approve\", ...deferredActions]", "non-draft quote status policy must block direct modification and risky actions");

const appendAuditBlock = sourceBlock(repositoryText, "appendAuditEntry");
requireMarker(appendAuditBlock, "company_id: context.companyId", "appendAuditEntry must write the server session company_id");
requireMarker(appendAuditBlock, "actor_app_user_id: context.appUserId", "appendAuditEntry must derive actor from trusted context");
requireMarker(appendAuditBlock, 'decision: "allowed"', "appendAuditEntry must force allowed decision for authorized route side effects");
requireMarker(appendAuditBlock, "metadata: sanitizeAuditMetadata", "appendAuditEntry must sanitize metadata");
requireNoRegex(appendAuditBlock, /\b(input|metadata)\.(actor|actor_app_user_id|company_id|decision|role)\b/i, "appendAuditEntry appears to accept spoofable audit authority fields");

if (violations.length) {
  console.error(violations.join("\n"));
  process.exit(1);
}

console.log("web server boundary check passed");
