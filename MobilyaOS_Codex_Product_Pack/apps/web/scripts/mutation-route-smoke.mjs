import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = dirname(scriptDir);
const repoRoot = findRepoRoot(appRoot);
const fakeCustomerId = "00000000-0000-4000-8000-000000000001";
const fakeProjectId = "00000000-0000-4000-8000-000000000002";
const fakeQuoteRevisionId = "00000000-0000-4000-8000-000000000003";
const fakeDocumentId = "00000000-0000-4000-8000-000000000004";
const fakeArtifactId = "00000000-0000-4000-8000-000000000005";
const demoCustomerId = "77777777-7777-4777-8777-777777777777";
const demoProjectId = "44444444-4444-4444-8444-444444444444";
const demoQuoteRevisionId = "14141414-1414-4141-8141-141414141414";
const demoApprovedQuoteRevisionId = "24242424-2424-4242-8242-242424242424";
const demoDocumentId = "18181818-1818-4181-8181-181818181818";
const secondTenantCustomerId = "99999999-9999-4999-8999-999999999998";
const secondTenantProjectId = "99999999-9999-4999-8999-999999999997";
const secondTenantQuoteRevisionId = "99999999-9999-4999-8999-999999999994";
const secondTenantSalesEmail = "tenantb-sales@demo.local";
const forbiddenPayloadKeys = [
  "SUPABASE_SERVICE_KEY",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "DIRECT_DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL_NON_POOLING",
  "DATABASE_PASSWORD",
  "app_user_id",
  "actor_id",
  "auth_user_id",
  "actor_app_user_id",
  "access_token",
  "refresh_token",
  "service_role",
  "signed_url",
  "storage_bucket",
  "storage_path",
  "token_hash",
  "artifact_html",
  "raw_storage_path",
  "database_password",
  "provider_secret",
  "smtp_password",
  "provider_message_id"
];
const forbiddenResponseFields = [
  "company_id",
  "auth_user_id",
  "actor_app_user_id",
  "access_token",
  "refresh_token",
  "service_role",
  "signed_url",
  "storage_bucket",
  "storage_path",
  "token_hash",
  "approval_token",
  "artifact_html",
  "raw_storage_path",
  "database_password",
  "provider_secret",
  "smtp_password",
  "provider_message_id",
  "recipient_email"
];
const forgedPayloadMarkers = {
  company_id: "browser-supplied",
  companyId: "browser-supplied-company",
  app_user_id: "browser-supplied-user",
  actor_id: "browser-supplied-actor",
  actor_app_user_id: "browser-supplied-actor",
  auth_user_id: "browser-supplied",
  role: "browser-supplied-admin",
  decision: "browser-supplied-decision",
  access_token: "browser-supplied",
  refresh_token: "browser-supplied",
  service_role: "browser-supplied",
  storage_path: "browser-supplied",
  raw_storage_path: "browser-supplied",
  signed_url: "browser-supplied",
  recipient_email: "browser-supplied@example.invalid",
  provider_secret: "browser-supplied",
  smtp_password: "browser-supplied",
  provider_message_id: "browser-supplied",
  artifact_html: "browser-supplied",
  database_password: "browser-supplied",
  SUPABASE_SERVICE_ROLE_KEY: "browser-supplied",
  DATABASE_URL: "browser-supplied",
  metadata: {
    actor_app_user_id: "browser-supplied-actor",
    company_id: "browser-supplied-company",
    decision: "browser-supplied-decision"
  }
};
const deferredQuoteActions = ["quote_send", "quote_approve", "quote_pdf", "production_package"];
const p9PostApprovalDeferredActions = ["quote_send", "quote_pdf", "production_package"];
const deterministicCalculationVersion = "wardrobe-deterministic-v1.0.0";
const canonicalSnapshotEdges = new Set(["north", "east", "south", "west"]);
const unavailableQuotePayloadFields = [
  "approval_id",
  "approved_at",
  "bom",
  "calculation_hash",
  "calculation_version",
  "cost",
  "document_url",
  "edges",
  "grand_total_minor",
  "labor",
  "margin",
  "markup_minor",
  "pdf_url",
  "production_job_id",
  "production_package_id",
  "quote_total",
  "sent_at",
  "sheet_count",
  "subtotal_minor",
  "tax",
  "total",
  "vat_minor",
  "storage_bucket"
];

function findRepoRoot(start) {
  let cursor = start;
  for (;;) {
    if (existsSync(join(cursor, "README.md")) && existsSync(join(cursor, "package.json"))) {
      return cursor;
    }
    const parent = dirname(cursor);
    if (parent === cursor) {
      throw new Error("Repository root was not found.");
    }
    cursor = parent;
  }
}

function requireSafe(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function includesForbiddenIdentifier(text, key) {
  if (/^[A-Z0-9_]+$/.test(key)) {
    return text.includes(key);
  }
  return new RegExp(`(^|[^A-Za-z0-9_])${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^A-Za-z0-9_]|$)`, "i").test(text);
}

function assertSafePayload(label, value) {
  const text = typeof value === "string" ? value : JSON.stringify(value) ?? "";
  for (const key of forbiddenPayloadKeys) {
    requireSafe(!includesForbiddenIdentifier(text, key), `${label} includes forbidden marker ${key}.`);
  }
}

function assertNoForbiddenResponseFields(label, value) {
  const text = JSON.stringify(value) ?? "";
  for (const key of forbiddenResponseFields) {
    requireSafe(!new RegExp(`"${key}"\\s*:`, "i").test(text), `${label} exposes forbidden response field ${key}.`);
  }
}

function forgedMarkerValues(value = forgedPayloadMarkers) {
  const values = [];
  for (const marker of Object.values(value)) {
    if (typeof marker === "string") {
      values.push(marker);
    } else if (marker && typeof marker === "object") {
      values.push(...forgedMarkerValues(marker));
    }
  }
  return [...new Set(values)];
}

function assertNoForgedPayloadEcho(label, value) {
  const text = typeof value === "string" ? value : JSON.stringify(value) ?? "";
  for (const marker of forgedMarkerValues()) {
    requireSafe(!text.includes(marker), `${label} reflects forged payload marker ${marker}.`);
  }
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (typeof address === "object" && address) {
          resolve(address.port);
        } else {
          reject(new Error("Could not allocate a local port."));
        }
      });
    });
  });
}

async function waitForServer(baseUrl, child) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    requireSafe(child.exitCode === null, "Next server exited before smoke tests could run.");
    try {
      const response = await fetch(`${baseUrl}/health`, { cache: "no-store" });
      if (response.ok) {
        return;
      }
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Next server did not become ready in time.");
}

async function startNextServer() {
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [nextCliPath(), "start", "-H", "127.0.0.1", "-p", String(port)], {
    cwd: appRoot,
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
    stdio: ["ignore", "ignore", "ignore"]
  });
  await waitForServer(baseUrl, child);
  return { baseUrl, child };
}

async function stopNextServer(child) {
  if (!child || child.exitCode !== null) {
    return;
  }
  await new Promise((resolve) => {
    child.once("exit", resolve);
    child.kill();
    setTimeout(resolve, 2_000);
  });
}

async function readJson(response, label) {
  const text = await response.text();
  assertSafePayload(label, text);
  assertNoForgedPayloadEcho(label, text);
  const payload = text ? JSON.parse(text) : {};
  assertNoForbiddenResponseFields(label, payload);
  assertNoForgedPayloadEcho(label, payload);
  return payload;
}

function firstCookie(setCookie) {
  return setCookie.split(";")[0];
}

function nextCliPath() {
  const candidates = [
    join(appRoot, "node_modules", "next", "dist", "bin", "next"),
    join(repoRoot, "node_modules", "next", "dist", "bin", "next")
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error("Next CLI was not found in local node_modules.");
  }
  return found;
}

async function login(baseUrl, email, password) {
  const response = await fetch(`${baseUrl}/api/supabase/demo-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  requireSafe(response.ok, "Demo login must succeed for mutation smoke.");
  assertSafePayload("login cookie", response.headers.get("set-cookie") || "");
  await readJson(response, "login payload");
  return firstCookie(response.headers.get("set-cookie") || "");
}

async function requestJson(baseUrl, path, options, label) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const payload = await readJson(response, label);
  return { response, payload };
}

async function requestText(baseUrl, path, options, label) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  assertSafePayload(label, text);
  assertNoForgedPayloadEcho(label, text);
  return { response, text };
}

function newApprovalSmokeToken() {
  return `smoke_${randomBytes(24).toString("base64url")}`;
}

function approvalSmokeTokenHash(token) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

async function patchApprovalTokenHashForSmoke(env, approvalId, tokenHash, overrides = {}) {
  const params = new URLSearchParams({
    id: `eq.${approvalId}`,
    select: "id,status"
  });
  const response = await fetch(`${env.supabaseUrl}/rest/v1/approvals?${params.toString()}`, {
    method: "PATCH",
    headers: {
      apikey: env.supabaseSecretKey,
      Authorization: `Bearer ${env.supabaseSecretKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify({
      token_hash: tokenHash,
      status: "pending",
      consumed_at: null,
      approval_consumption_version: null,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      ...overrides
    }),
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`Approval consumption smoke setup failed with status ${response.status}.`);
  }
  const rows = await response.json();
  assertNoForbiddenResponseFields("approval consumption smoke setup", rows);
  requireSafe(Array.isArray(rows) && rows.length === 1, "Approval consumption smoke setup must update exactly one row.");
}

function countAuditActions(entries) {
  const counts = new Map();
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (entry?.decision !== "allowed") {
      continue;
    }
    counts.set(entry.action, (counts.get(entry.action) ?? 0) + 1);
  }
  return counts;
}

function countAllAuditActions(entries) {
  const counts = new Map();
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (typeof entry?.action !== "string") {
      continue;
    }
    counts.set(entry.action, (counts.get(entry.action) ?? 0) + 1);
  }
  return counts;
}

function requireAuditIncrease(before, after, action) {
  requireSafe(
    (after.get(action) ?? 0) > (before.get(action) ?? 0),
    `Audit entries must append an allowed ${action} row.`
  );
}

function requireAuditActionIncrease(before, after, action) {
  requireSafe(
    (after.get(action) ?? 0) > (before.get(action) ?? 0),
    `Audit entries must append a ${action} row.`
  );
}

function requireAuditDelta(before, after, action, expectedDelta) {
  const delta = (after.get(action) ?? 0) - (before.get(action) ?? 0);
  requireSafe(delta === expectedDelta, `Audit ${action} delta must be ${expectedDelta}, got ${delta}.`);
}

function requireAuditUnchanged(before, after, action) {
  requireAuditDelta(before, after, action, 0);
}

function assertAuditTimelineShape(entries, label) {
  requireSafe(Array.isArray(entries), `${label} must include an audit timeline array.`);
  let previous = Number.POSITIVE_INFINITY;
  for (const entry of entries) {
    requireSafe(typeof entry.id === "string" && entry.id.length > 0, `${label} audit entry must include id.`);
    requireSafe(typeof entry.action === "string" && entry.action.length > 0, `${label} audit entry must include action.`);
    requireSafe(typeof entry.target_type === "string" && entry.target_type.length > 0, `${label} audit entry must include target_type.`);
    requireSafe(entry.target_id === null || typeof entry.target_id === "string", `${label} audit entry target_id must be safe.`);
    requireSafe(entry.decision === "allowed" || entry.decision === "denied", `${label} audit entry decision must be bounded.`);
    const timestamp = Date.parse(entry.created_at);
    requireSafe(Number.isFinite(timestamp), `${label} audit entry must include a valid timestamp.`);
    requireSafe(timestamp <= previous, `${label} audit entries must be newest-first.`);
    previous = timestamp;
  }
}

function assertQuoteDraftDeferred(payload, label) {
  requireSafe(payload.quote_revision?.status === "draft", `${label} status must remain draft.`);
  requireSafe(payload.calculation_status === "not_calculated", `${label} calculation must remain unavailable.`);
  requireSafe(Array.isArray(payload.deferred_actions), `${label} response must list deferred actions.`);
  for (const action of deferredQuoteActions) {
    requireSafe(payload.deferred_actions.includes(action), `${label} must keep ${action} deferred.`);
  }
  requireSafe(
    payload.deferred_actions.every((action) => deferredQuoteActions.includes(action)),
    `${label} must not advertise active quote/PDF/production actions.`
  );
  const text = JSON.stringify(payload) ?? "";
  for (const field of unavailableQuotePayloadFields) {
    requireSafe(!new RegExp(`"${field}"\\s*:`, "i").test(text), `${label} exposes unavailable field ${field}.`);
  }
}

function parseEnvFile(path) {
  if (!existsSync(path)) {
    return {};
  }
  const values = {};
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) {
      continue;
    }
    if (line.startsWith("export ")) {
      line = line.slice("export ".length).trimStart();
    }
    const equals = line.indexOf("=");
    const key = line.slice(0, equals).trim();
    let value = line.slice(equals + 1).trim();
    if (value.length >= 2 && value[0] === value[value.length - 1] && ["'", "\""].includes(value[0])) {
      value = value.slice(1, -1);
    }
    if (key) {
      values[key] = value;
    }
  }
  return values;
}

function localEnv() {
  return {
    ...parseEnvFile(join(repoRoot, ".env")),
    ...parseEnvFile(join(repoRoot, ".env.local")),
    ...process.env
  };
}

function serviceRoleEnv() {
  const values = localEnv();
  requireSafe(Boolean(values.SUPABASE_URL), "Supabase URL must be configured for approval consumption smoke.");
  requireSafe(Boolean(values.SUPABASE_SECRET_KEY), "Supabase service key must be configured for approval consumption smoke.");
  return {
    supabaseUrl: values.SUPABASE_URL.replace(/\/+$/, ""),
    supabaseSecretKey: values.SUPABASE_SECRET_KEY
  };
}

function assertConfigurationDraftDeferred(payload, expected, label) {
  const draft = payload.configuration_draft;
  requireSafe(Boolean(draft?.id), `${label} must include a safe configuration draft id.`);
  requireSafe(draft.validation_status === "draft_validated", `${label} must report draft validation only.`);
  requireSafe(draft.calculation_status === "not_calculated", `${label} must not report calculated state.`);
  requireSafe(payload.calculation_status === "not_calculated", `${label} top-level calculation state must remain unavailable.`);
  requireSafe(Array.isArray(payload.deferred_actions), `${label} response must list deferred actions.`);
  for (const action of ["bom_calculation", "cost_snapshot", ...deferredQuoteActions]) {
    requireSafe(payload.deferred_actions.includes(action), `${label} must keep ${action} deferred.`);
  }
  const configuration = draft.configuration;
  requireSafe(configuration?.template_code === "wardrobe", `${label} template must be sanitized.`);
  requireSafe(configuration.width_mm === expected.width_mm, `${label} width must match sanitized input.`);
  requireSafe(configuration.height_mm === expected.height_mm, `${label} height must match sanitized input.`);
  requireSafe(configuration.depth_mm === expected.depth_mm, `${label} depth must match sanitized input.`);
  requireSafe(configuration.quantity === expected.quantity, `${label} quantity must match sanitized input.`);
  requireSafe(configuration.door_count === expected.door_count, `${label} door count must match sanitized input.`);
  requireSafe(configuration.shelf_count === expected.shelf_count, `${label} shelf count must match sanitized input.`);
  requireSafe(configuration.material_sku === expected.material_sku, `${label} material SKU must match sanitized input.`);
  requireSafe(configuration.edge_band_sku === expected.edge_band_sku, `${label} edge band SKU must match sanitized input.`);
  const text = JSON.stringify(payload) ?? "";
  for (const field of unavailableQuotePayloadFields) {
    requireSafe(!new RegExp(`"${field}"\\s*:`, "i").test(text), `${label} exposes unavailable field ${field}.`);
  }
}

function requireInteger(value, label) {
  requireSafe(Number.isSafeInteger(value), `${label} must be a safe integer.`);
}

function requireNonnegativeInteger(value, label) {
  requireInteger(value, label);
  requireSafe(value >= 0, `${label} must be non-negative.`);
}

function requirePositiveInteger(value, label) {
  requireInteger(value, label);
  requireSafe(value > 0, `${label} must be positive.`);
}

function assertQuoteSnapshotNotCalculated(payload, label) {
  requireSafe(payload.calculation_status === "not_calculated", `${label} must remain not_calculated.`);
  requireSafe(payload.bom_snapshot === null, `${label} must not expose a BOM snapshot.`);
  requireSafe(payload.cost_snapshot === null, `${label} must not expose a cost snapshot.`);
  requireSafe(Array.isArray(payload.deferred_actions), `${label} response must list deferred actions.`);
  for (const action of deferredQuoteActions) {
    requireSafe(payload.deferred_actions.includes(action), `${label} must keep ${action} deferred.`);
  }
}

function assertQuoteSnapshotCalculated(payload, expected, label) {
  const bom = payload.bom_snapshot;
  const cost = payload.cost_snapshot;
  requireSafe(payload.calculation_status === "calculated", `${label} must report calculated state.`);
  requireSafe(payload.quote_revision?.id === expected.quoteRevisionId, `${label} must reference the requested quote revision.`);
  requireSafe(payload.quote_revision?.status === "draft", `${label} must keep the quote revision in draft.`);
  requireSafe(payload.configuration_draft?.id === expected.configurationDraftId, `${label} must reference the calculated configuration draft.`);
  requireSafe(payload.configuration_draft?.version === expected.configurationVersion, `${label} must reference the calculated configuration version.`);
  requireSafe(Boolean(bom?.id), `${label} must include a persisted BOM snapshot id.`);
  requireSafe(Boolean(cost?.id), `${label} must include a persisted cost snapshot id.`);
  requireSafe(bom.revision_id === expected.quoteRevisionId, `${label} BOM snapshot must belong to the quote revision.`);
  requireSafe(cost.revision_id === expected.quoteRevisionId, `${label} cost snapshot must belong to the quote revision.`);
  requireSafe(bom.formula_version === deterministicCalculationVersion, `${label} BOM formula version must be deterministic P6.`);
  requireSafe(cost.formula_version === deterministicCalculationVersion, `${label} cost formula version must be deterministic P6.`);
  requireSafe(/^[0-9a-f]{64}$/i.test(bom.snapshot_hash), `${label} BOM snapshot hash must be sha256.`);
  requireSafe(/^[0-9a-f]{64}$/i.test(cost.snapshot_hash), `${label} cost snapshot hash must be sha256.`);
  requireSafe(Array.isArray(bom.parts) && bom.parts.length === bom.part_count, `${label} BOM part count must match parts.`);
  requireSafe(Array.isArray(bom.edges) && bom.edges.length === bom.edge_count, `${label} BOM edge count must match edges.`);
  requireSafe(bom.part_count === 6, `${label} wardrobe slice must group the expected six BOM part rows.`);
  requireSafe(bom.edge_count === 11, `${label} wardrobe slice must produce the expected eleven edge rows.`);

  for (const part of bom.parts) {
    requireSafe(typeof part.code === "string" && part.code.length > 0, `${label} part code must be present.`);
    requirePositiveInteger(part.width_mm, `${label} ${part.code} width`);
    requirePositiveInteger(part.height_mm, `${label} ${part.code} height`);
    requirePositiveInteger(part.quantity, `${label} ${part.code} quantity`);
    requirePositiveInteger(part.area_mm2, `${label} ${part.code} area`);
    requireSafe(part.area_mm2 === part.width_mm * part.height_mm * part.quantity, `${label} ${part.code} area must be deterministic.`);
  }

  for (const edge of bom.edges) {
    requireSafe(canonicalSnapshotEdges.has(edge.edge), `${label} edge ${edge.edge} must be canonical.`);
    requirePositiveInteger(edge.length_mm, `${label} ${edge.part_code} edge length`);
    requirePositiveInteger(edge.part_quantity, `${label} ${edge.part_code} edge part quantity`);
    requirePositiveInteger(edge.base_length_mm, `${label} ${edge.part_code} edge base length`);
    requireSafe(edge.base_length_mm === edge.length_mm * edge.part_quantity, `${label} ${edge.part_code} edge base length must be deterministic.`);
    requireNonnegativeInteger(edge.waste_bps, `${label} ${edge.part_code} edge waste`);
    requireNonnegativeInteger(edge.setup_mm, `${label} ${edge.part_code} edge setup`);
    requirePositiveInteger(edge.billable_mm, `${label} ${edge.part_code} edge billable length`);
    const expectedBillable = Math.ceil((edge.base_length_mm * (10_000 + edge.waste_bps)) / 10_000) + edge.setup_mm;
    requireSafe(edge.billable_mm === expectedBillable, `${label} ${edge.part_code} edge billable length must include waste.`);
  }

  requireSafe(cost.currency === "TRY", `${label} cost currency must remain TRY.`);
  for (const field of ["subtotal_minor", "markup_minor", "vat_minor", "grand_total_minor"]) {
    requireNonnegativeInteger(cost[field], `${label} ${field}`);
    requireSafe(cost.quote_total[field] === cost[field], `${label} quote_total ${field} must match persisted cost snapshot.`);
  }
  requireSafe(Array.isArray(cost.categories) && cost.categories.length >= 5, `${label} must include cost categories.`);
  const categorySubtotal = cost.categories.reduce((sum, item) => {
    requireNonnegativeInteger(item.amount_minor, `${label} ${item.category} amount`);
    requireSafe(item.currency === "TRY", `${label} ${item.category} currency must be TRY.`);
    return sum + item.amount_minor;
  }, 0);
  requireSafe(categorySubtotal === cost.subtotal_minor, `${label} category subtotal must equal persisted subtotal.`);

  requireSafe(Array.isArray(cost.labor), `${label} must include labor rows.`);
  const unitLabor = cost.labor.find((row) => row.labor_type === "unit");
  const setupLabor = cost.labor.find((row) => row.labor_type === "setup");
  requireSafe(Boolean(unitLabor), `${label} must include unit labor.`);
  requireSafe(Boolean(setupLabor), `${label} must include setup labor.`);
  requirePositiveInteger(unitLabor.unit_labor_minor, `${label} unit labor rate`);
  requireSafe(unitLabor.quantity === expected.quantity, `${label} unit labor quantity must match configured quantity.`);
  requireSafe(unitLabor.total_minor === unitLabor.unit_labor_minor * expected.quantity, `${label} unit labor total must be rate times quantity.`);
  requireSafe(setupLabor.quantity === 1, `${label} setup labor quantity must stay one.`);
  requireSafe(setupLabor.total_minor === setupLabor.unit_labor_minor, `${label} setup labor total must equal setup rate.`);

  requireSafe(cost.provenance?.source === "deterministic_service", `${label} provenance source must be deterministic.`);
  requireSafe(cost.provenance?.calculation_version === deterministicCalculationVersion, `${label} provenance version must match.`);
  requireSafe(cost.provenance?.configuration_draft_id === expected.configurationDraftId, `${label} provenance must bind to the configuration draft.`);
  requireSafe(cost.provenance?.configuration_version === expected.configurationVersion, `${label} provenance must bind to the configuration version.`);
  requireSafe(cost.provenance?.quote_revision_id === expected.quoteRevisionId, `${label} provenance must bind to the quote revision.`);
  requireSafe(cost.provenance?.bom_snapshot_hash === bom.snapshot_hash, `${label} provenance must bind to the BOM snapshot.`);
  requireSafe(Array.isArray(cost.provenance?.price_sources) && cost.provenance.price_sources.length >= 5, `${label} must list price sources.`);
  requireSafe(!JSON.stringify(payload).toLowerCase().includes("llm"), `${label} must not mention an LLM as calculation source.`);
  for (const action of deferredQuoteActions) {
    requireSafe(payload.deferred_actions.includes(action), `${label} must keep ${action} deferred.`);
  }
}

function moneyMinorText(amountMinor, currency) {
  const whole = Math.floor(amountMinor / 100);
  const cents = String(amountMinor % 100).padStart(2, "0");
  return `${whole}.${cents} ${currency}`;
}

function assertFrozenQuoteDocument(payload, expected, label) {
  const document = payload.document;
  requireSafe(Boolean(document?.id), `${label} must include a document id.`);
  requireSafe(document.revision_id === expected.quoteRevisionId, `${label} must bind to the quote revision.`);
  requireSafe(document.cost_snapshot_id === expected.costSnapshotId, `${label} must bind to the cost snapshot.`);
  requireSafe(document.document_type === "quote_html", `${label} document type must be quote_html.`);
  requireSafe(document.content_type === "text/html; charset=utf-8", `${label} content type must be HTML.`);
  requireSafe(document.document_version === "quote-html-v1.0.0", `${label} document version must be deterministic.`);
  requireSafe(document.revision_version === expected.quoteRevisionVersion, `${label} must bind quote revision version.`);
  requireSafe(document.snapshot_hash === expected.costSnapshotHash, `${label} must bind cost snapshot hash.`);
  requireSafe(document.calculation_version === deterministicCalculationVersion, `${label} must bind calculation version.`);
  requireSafe(/^[0-9a-f]{64}$/i.test(document.sha256), `${label} document hash must be sha256.`);
  requirePositiveInteger(document.size_bytes, `${label} document size`);
  requireSafe(document.provenance?.source === "deterministic_server_document", `${label} provenance source must be deterministic.`);
  requireSafe(document.provenance?.storage === "server_route_mediated", `${label} storage must be mediated by server route.`);
  requireSafe(document.provenance?.pdf_status === "deferred", `${label} PDF must remain deferred.`);
  requireSafe(document.artifact?.kind === "html", `${label} artifact kind must remain HTML.`);
  requireSafe(document.artifact?.access_model === "controlled_server_preview_route", `${label} artifact access must be server-route controlled.`);
  requireSafe(document.artifact?.storage_status === "metadata_recorded", `${label} artifact storage status must be metadata only.`);
  requireSafe(document.artifact?.binary_pdf_status === "deferred", `${label} binary PDF must remain deferred.`);
  requireSafe(!("html" in document), `${label} document JSON must not expose artifact HTML.`);
  assertNoForbiddenResponseFields(label, payload);
}

function assertFrozenQuoteDocumentArtifact(html, expected, label) {
  requireSafe(typeof html === "string" && html.startsWith("<!doctype html>"), `${label} preview HTML must be served by the artifact route.`);
  requireSafe(!/<script/i.test(html), `${label} preview HTML must not contain script tags.`);
  requireSafe(html.includes(expected.costSnapshotHash), `${label} HTML must include the trusted cost snapshot hash.`);
  requireSafe(
    html.includes(moneyMinorText(expected.grandTotalMinor, expected.currency)),
    `${label} HTML total must match the cost snapshot total.`
  );
}

function assertQuoteFork(payload, expected, label) {
  const revision = payload.quote_revision;
  requireSafe(Boolean(revision?.id), `${label} must include a fork revision id.`);
  requireSafe(revision.id !== expected.sourceRevisionId, `${label} fork id must be new.`);
  requireSafe(revision.parent_revision_id === expected.sourceRevisionId, `${label} fork must point to the source parent.`);
  requireSafe(revision.project_id === expected.projectId, `${label} fork must stay in the same project.`);
  requireSafe(revision.status === "draft", `${label} fork must be draft.`);
  requireSafe(revision.version === 1, `${label} fork must start at version 1.`);
  requireSafe(payload.snapshot_copy_policy === "snapshots_not_copied", `${label} must not copy snapshots.`);
  requireSafe(payload.document_copy_policy === "documents_not_copied", `${label} must not copy documents.`);
  requireSafe(payload.configuration_draft?.quote_revision_id === revision.id, `${label} must copy config to the fork only.`);
  requireSafe(payload.configuration_draft?.calculation_status === "not_calculated", `${label} fork config must require recalculation.`);
}

function assertRevisionDiff(payload, expected, label) {
  const diff = payload.diff;
  requireSafe(diff?.source === "deterministic_server_diff", `${label} source must be deterministic.`);
  requireSafe(diff.diff_version === "revision-diff-v1.0.0", `${label} version must match.`);
  requireSafe(diff.left_revision?.id === expected.leftRevisionId, `${label} left revision must match.`);
  requireSafe(diff.right_revision?.id === expected.rightRevisionId, `${label} right revision must match.`);
  requireSafe(Array.isArray(diff.entries), `${label} entries must be an array.`);
  requireSafe(
    diff.entries.some((entry) => entry.field === "parent_revision_id"),
    `${label} must include the parent revision difference.`
  );
}

function assertApprovalGate(payload, expected, label) {
  const gate = payload.approval_gate;
  requireSafe(Boolean(gate?.id), `${label} must include an approval id.`);
  requireSafe(gate.revision_id === expected.quoteRevisionId, `${label} must bind to the quote revision.`);
  requireSafe(gate.action === "quote_approve", `${label} action must be quote_approve.`);
  requireSafe(gate.status === "pending", `${label} status must be pending.`);
  requireSafe(gate.token_secret_returned === false, `${label} must not return the token secret.`);
  requireSafe(gate.generated_document_id === expected.documentId, `${label} must bind document id.`);
  requireSafe(gate.document_hash === expected.documentHash, `${label} must bind document hash.`);
  requireSafe(gate.snapshot_hash === expected.costSnapshotHash, `${label} must bind snapshot hash.`);
  requireSafe(gate.quote_revision_version === expected.quoteRevisionVersion, `${label} must bind revision version.`);
  requireSafe(gate.quote_status_changed === false || gate.quote_status_changed === undefined, `${label} must not change quote status.`);
  requireSafe(Date.parse(gate.expires_at) > Date.now(), `${label} must include a future expiry.`);
  assertNoForbiddenResponseFields(label, payload);
}

function assertApprovalConsumption(payload, expectedStatus, label, options = {}) {
  const consumption = payload.approval_consumption;
  requireSafe(consumption?.status === expectedStatus, `${label} must return ${expectedStatus}.`);
  requireSafe(consumption.token_secret_returned === false, `${label} must never return token secret.`);
  requireSafe(
    consumption.quote_status_changed === Boolean(options.quoteStatusChanged),
    `${label} quote status change flag must be ${Boolean(options.quoteStatusChanged)}.`
  );
  requireSafe(consumption.quote_send_triggered === false, `${label} must not send quote.`);
  requireSafe(consumption.production_package_triggered === false, `${label} must not trigger production package.`);
  requireSafe(Array.isArray(consumption.deferred_actions), `${label} must include deferred actions.`);
  for (const action of p9PostApprovalDeferredActions) {
    requireSafe(consumption.deferred_actions.includes(action), `${label} must keep ${action} deferred.`);
  }
  assertNoForbiddenResponseFields(label, payload);
}

function assertSendGate(payload, expected, label) {
  const sendGate = payload.send_gate;
  requireSafe(sendGate?.revision_id === expected.quoteRevisionId, `${label} must bind to the quote revision.`);
  requireSafe(sendGate.quote_status === expected.quoteStatus, `${label} quote status must be ${expected.quoteStatus}.`);
  requireSafe(sendGate.approved_revision === expected.approved, `${label} approved flag must be ${expected.approved}.`);
  requireSafe(sendGate.eligible_to_send === false, `${label} must never become send-executable in P10.`);
  if (typeof expected.eligibleToPrepare === "boolean") {
    requireSafe(
      sendGate.eligible_to_prepare_send === expected.eligibleToPrepare,
      `${label} prepare flag must be ${expected.eligibleToPrepare}.`
    );
  }
  if (typeof expected.artifactBound === "boolean") {
    requireSafe(sendGate.artifact_bound === expected.artifactBound, `${label} artifact bound flag must be ${expected.artifactBound}.`);
  }
  requireSafe(sendGate.quote_send_triggered === false, `${label} must not send a quote.`);
  requireSafe(sendGate.production_package_triggered === false, `${label} must not trigger production package.`);
  requireSafe(sendGate.email_provider_configured === false, `${label} must report no configured email provider.`);
  if (expected.artifactStatus) {
    requireSafe(sendGate.artifact_status === expected.artifactStatus, `${label} artifact status must be ${expected.artifactStatus}.`);
  } else {
    requireSafe(
      ["html_storage_missing", "html_stored_pdf_deferred"].includes(sendGate.artifact_status),
      `${label} must report a P10 artifact status.`
    );
  }
  requireSafe(Array.isArray(sendGate.blocking_reasons), `${label} must include blocking reasons.`);
  assertNoForbiddenResponseFields(label, payload);
}

function assertStoredQuoteArtifact(payload, expected, label) {
  const artifact = payload.artifact;
  requireSafe(Boolean(artifact?.id), `${label} must include an artifact id.`);
  requireSafe(artifact.revision_id === expected.quoteRevisionId, `${label} must bind to quote revision.`);
  requireSafe(artifact.generated_document_id === expected.documentId, `${label} must bind to generated document.`);
  requireSafe(artifact.cost_snapshot_id === expected.costSnapshotId, `${label} must bind to cost snapshot.`);
  requireSafe(artifact.artifact_type === "quote_html_storage", `${label} type must be quote_html_storage.`);
  requireSafe(artifact.status === "stored", `${label} status must be stored.`);
  requireSafe(artifact.content_type === "text/html; charset=utf-8", `${label} content type must be HTML.`);
  requireSafe(artifact.sha256 === expected.documentHash, `${label} artifact hash must match frozen document hash.`);
  requireSafe(artifact.source_document_hash === expected.documentHash, `${label} source hash must match frozen document hash.`);
  requireSafe(artifact.snapshot_hash === expected.costSnapshotHash, `${label} snapshot hash must match cost snapshot.`);
  requireSafe(artifact.revision_version === expected.quoteRevisionVersion, `${label} revision version must bind.`);
  requirePositiveInteger(artifact.size_bytes, `${label} artifact size`);
  requireSafe(artifact.size_bytes === expected.documentSizeBytes, `${label} artifact bytes must match frozen document size.`);
  requireSafe(artifact.artifact_version === "quote-html-storage-v1.0.0", `${label} artifact version must be deterministic.`);
  requireSafe(artifact.renderer_version === "quote-html-storage-adapter-v1.0.0", `${label} renderer version must be deterministic.`);
  requireSafe(artifact.storage_status === "object_stored", `${label} storage status must be object_stored.`);
  requireSafe(artifact.access_model === "server_mediated_download", `${label} access model must be server mediated.`);
  requireSafe(artifact.signed_url_returned === false, `${label} must not return signed URL.`);
  requireSafe(artifact.external_url_generated === false, `${label} must not return external URL.`);
  requireSafe(artifact.pdf_status === "deferred", `${label} binary PDF must remain deferred.`);
  requireSafe(Array.isArray(artifact.deferred_actions), `${label} must include deferred actions.`);
  requireSafe(artifact.deferred_actions.includes("quote_pdf"), `${label} must keep quote_pdf deferred.`);
  assertNoForbiddenResponseFields(label, payload);
}

function assertSendIntent(payload, expected, label) {
  const intent = payload.send_intent;
  requireSafe(Boolean(intent?.id), `${label} must include a send intent id.`);
  requireSafe(intent.revision_id === expected.quoteRevisionId, `${label} must bind quote revision.`);
  requireSafe(intent.artifact_id === expected.artifactId, `${label} must bind stored artifact.`);
  requireSafe(intent.generated_document_id === expected.documentId, `${label} must bind generated document.`);
  requireSafe(["send_deferred", "send_blocked"].includes(intent.status), `${label} must stay deferred or blocked without provider.`);
  requireSafe(intent.provider_status === "provider_missing", `${label} provider status must be missing.`);
  requireSafe(["project_customer", "missing_customer_email"].includes(intent.recipient_source), `${label} recipient source must be server-derived.`);
  requireSafe(intent.email_provider_configured === false, `${label} email provider must remain unconfigured.`);
  requireSafe(intent.external_delivery_attempted === false, `${label} must not attempt external delivery.`);
  requireSafe(intent.quote_sent === false, `${label} must not mark quote sent.`);
  requireSafe(intent.production_package_triggered === false, `${label} must not trigger production package.`);
  requireSafe(intent.send_version === "quote-send-intent-v1.0.0", `${label} send version must be deterministic.`);
  requireSafe(Array.isArray(intent.deferred_actions), `${label} must include deferred actions.`);
  requireSafe(intent.deferred_actions.includes("quote_send_external_delivery"), `${label} must keep external send deferred.`);
  requireSafe(intent.deferred_actions.includes("production_package"), `${label} must keep production package deferred.`);
  assertNoForbiddenResponseFields(label, payload);
}

function configurationDraftBody(overrides = {}) {
  return {
    ...forgedPayloadMarkers,
    template_code: "wardrobe",
    width_mm: 1800,
    height_mm: 2200,
    depth_mm: 600,
    quantity: 1,
    door_count: 3,
    shelf_count: 4,
    material_sku: "MDF-LAM-BEYAZ-18",
    edge_band_sku: "PVC-BEYAZ-1MM",
    notes: "Smoke test wardrobe draft",
    status: "approved",
    calculation_status: "calculated",
    product_variant_id: fakeQuoteRevisionId,
    bom: [{ code: "browser-supplied" }],
    cost: { grand_total_minor: 1 },
    grand_total_minor: 1,
    quote_total: 1,
    sheet_count: 1,
    ...overrides
  };
}

async function main() {
  requireSafe(existsSync(join(appRoot, ".next")), "Next build output is missing. Run npm run build -w apps/web first.");

  const password = process.env.DEMO_SEED_PASSWORD || "Demo1234!ChangeMe";
  requireSafe(Boolean(password), "Demo password is not configured.");

  let child;
  let baseUrl;

  try {
    ({ baseUrl, child } = await startNextServer());

    const mutationProbes = [
      {
        key: "customer",
        path: "/api/supabase/customers",
        body: { ...forgedPayloadMarkers, name: "Probe Customer" }
      },
      {
        key: "project",
        path: "/api/supabase/projects",
        body: { ...forgedPayloadMarkers, customer_id: fakeCustomerId, name: "Probe Project" }
      },
      {
        key: "quote-draft",
        path: `/api/supabase/projects/${fakeProjectId}/quote-drafts`,
        body: { ...forgedPayloadMarkers, status: "sent" }
      },
      {
        key: "configuration-draft",
        path: `/api/supabase/quote-revisions/${fakeQuoteRevisionId}/configuration-draft`,
        body: configurationDraftBody()
      },
      {
        key: "quote-calculate",
        path: `/api/supabase/quote-revisions/${fakeQuoteRevisionId}/calculate`,
        body: { expected_configuration_version: 1 }
      },
      {
        key: "quote-document",
        path: `/api/supabase/quote-revisions/${fakeQuoteRevisionId}/documents`,
        body: { ...forgedPayloadMarkers, grand_total_minor: 1 }
      },
      {
        key: "quote-fork",
        path: `/api/supabase/quote-revisions/${fakeQuoteRevisionId}/fork`,
        body: { ...forgedPayloadMarkers, expected_revision_version: 1, status: "approved" }
      },
      {
        key: "approval-token",
        path: `/api/supabase/quote-revisions/${fakeQuoteRevisionId}/approval-token`,
        body: { ...forgedPayloadMarkers, document_id: fakeDocumentId, token_hash: "browser-supplied" }
      },
      {
        key: "artifact",
        path: `/api/supabase/quote-revisions/${fakeQuoteRevisionId}/artifacts`,
        body: { ...forgedPayloadMarkers, sha256: "0".repeat(64), status: "stored" }
      },
      {
        key: "send-intent",
        path: `/api/supabase/quote-revisions/${fakeQuoteRevisionId}/send-intents`,
        body: { ...forgedPayloadMarkers, status: "sent", quote_sent: true }
      }
    ];

    let result;
    const readProbes = [
      {
        label: "unauthenticated customers read",
        path: "/api/supabase/customers"
      },
      {
        label: "unauthenticated projects read",
        path: "/api/supabase/projects"
      },
      {
        label: "unauthenticated project detail read",
        path: `/api/supabase/projects/${fakeProjectId}`
      },
      {
        label: "unauthenticated quote revisions read",
        path: `/api/supabase/projects/${fakeProjectId}/quote-revisions`
      },
      {
        label: "unauthenticated quote revision get",
        path: `/api/supabase/quote-revisions/${fakeQuoteRevisionId}`
      },
      {
        label: "unauthenticated configuration draft get",
        path: `/api/supabase/quote-revisions/${fakeQuoteRevisionId}/configuration-draft`
      },
      {
        label: "unauthenticated quote snapshot get",
        path: `/api/supabase/quote-revisions/${fakeQuoteRevisionId}/snapshot`
      },
      {
        label: "unauthenticated quote document list",
        path: `/api/supabase/quote-revisions/${fakeQuoteRevisionId}/documents`
      },
      {
        label: "unauthenticated quote document preview",
        path: `/api/supabase/documents/${fakeDocumentId}`
      },
      {
        label: "unauthenticated quote document artifact preview",
        path: `/api/supabase/documents/${fakeDocumentId}/preview`
      },
      {
        label: "unauthenticated quote revision diff",
        path: `/api/supabase/quote-revisions/${fakeQuoteRevisionId}/diff?against=${fakeQuoteRevisionId}`
      },
      {
        label: "unauthenticated approval status",
        path: `/api/supabase/quote-revisions/${fakeQuoteRevisionId}/approval-status`
      },
      {
        label: "unauthenticated send gate status",
        path: `/api/supabase/quote-revisions/${fakeQuoteRevisionId}/send-gate`
      },
      {
        label: "unauthenticated quote artifacts list",
        path: `/api/supabase/quote-revisions/${fakeQuoteRevisionId}/artifacts`
      },
      {
        label: "unauthenticated quote artifact detail",
        path: `/api/supabase/artifacts/${fakeArtifactId}`
      },
      {
        label: "unauthenticated quote artifact download",
        path: `/api/supabase/artifacts/${fakeArtifactId}/download`
      }
    ];
    for (const probe of readProbes) {
      result = await requestJson(baseUrl, probe.path, { method: "GET" }, probe.label);
      requireSafe(result.response.status === 401, `${probe.label} must return 401.`);
    }

    for (const probe of mutationProbes) {
      result = await requestJson(baseUrl, probe.path, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-idempotency-key": `no-session-${probe.key}-mutation-smoke` },
        body: JSON.stringify(probe.body)
      }, `unauthenticated ${probe.key} mutation`);
      requireSafe(result.response.status === 401, `Unauthenticated ${probe.key} mutation must return 401.`);
    }

    result = await requestJson(baseUrl, "/api/supabase/approval-tokens/consume", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://cross-site.invalid",
        "Sec-Fetch-Site": "cross-site"
      },
      body: JSON.stringify({ approval_token: newApprovalSmokeToken() })
    }, "cross-site approval token consume");
    requireSafe(result.response.status === 403, "Cross-site approval token consumption must return 403.");

    result = await requestJson(baseUrl, "/api/supabase/approval-tokens/consume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approval_token: "short" })
    }, "malformed approval token consume");
    requireSafe(result.response.status === 422, "Malformed approval token consumption must return 422.");
    assertApprovalConsumption(result.payload, "invalid", "malformed approval token consume");

    const missingApprovalToken = newApprovalSmokeToken();
    result = await requestJson(baseUrl, "/api/supabase/approval-tokens/consume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approval_token: missingApprovalToken })
    }, "missing approval token consume");
    requireSafe(result.response.status === 404, "Missing approval token consumption must return 404.");
    assertApprovalConsumption(result.payload, "invalid", "missing approval token consume");

    const rateLimitToken = newApprovalSmokeToken();
    let rateLimitedStatus = 0;
    for (let index = 0; index < 7; index += 1) {
      const rateLimitProbe = await requestJson(baseUrl, "/api/supabase/approval-tokens/consume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approval_token: rateLimitToken })
      }, `approval token rate limit probe ${index}`);
      rateLimitedStatus = rateLimitProbe.response.status;
    }
    requireSafe(rateLimitedStatus === 429, "Approval token consumption must rate limit repeated token attempts.");

    const viewerCookie = await login(baseUrl, "viewer@demo.local", password);
    for (const probe of mutationProbes) {
      result = await requestJson(baseUrl, probe.path, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: viewerCookie, "x-idempotency-key": `viewer-denied-${probe.key}-mutation-smoke` },
        body: JSON.stringify(probe.body)
      }, `viewer ${probe.key} mutation`);
      requireSafe(result.response.status === 403, `Viewer ${probe.key} mutation must return 403.`);
    }
    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${fakeQuoteRevisionId}/configuration-draft`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: viewerCookie, "x-idempotency-key": "viewer-denied-configuration-update-mutation-smoke" },
      body: JSON.stringify(configurationDraftBody({ expected_version: 1, width_mm: 1900 }))
    }, "viewer configuration draft update");
    requireSafe(result.response.status === 403, "Viewer configuration draft update must return 403.");
    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${fakeQuoteRevisionId}/calculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: viewerCookie, "x-idempotency-key": "viewer-denied-calculate-mutation-smoke" },
      body: JSON.stringify({ expected_configuration_version: 1 })
    }, "viewer quote calculate");
    requireSafe(result.response.status === 403, "Viewer quote calculate must return 403.");

    const salesCookie = await login(baseUrl, "satis@demo.local", password);
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const crossActionKey = `cross-action-${suffix}`;
    const customerKey = crossActionKey;
    const projectKey = crossActionKey;
    const quoteDraftKey = crossActionKey;
    const configCreateKey = crossActionKey;
    const configUpdateKey = crossActionKey;

    result = await requestJson(baseUrl, "/api/supabase/demo-data", {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "audit baseline");
    requireSafe(result.response.ok, "Demo data must succeed before mutation audit baseline.");
    const primaryDemoData = result.payload;
    const auditBefore = countAuditActions(result.payload.audit_entries);
    const auditBeforeAll = countAllAuditActions(result.payload.audit_entries);

    result = await requestJson(baseUrl, "/api/supabase/customers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: salesCookie,
        "x-idempotency-key": `csrf-customer-${suffix}`,
        Origin: "https://cross-site.invalid",
        "Sec-Fetch-Site": "cross-site"
      },
      body: JSON.stringify({ ...forgedPayloadMarkers, name: `CSRF Probe ${suffix}` })
    }, "cross-site customer mutation");
    requireSafe(result.response.status === 403, "Cross-site customer mutation must return 403.");

    result = await requestJson(baseUrl, "/api/supabase/demo-data", {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "audit after csrf probe");
    requireSafe(result.response.ok, "Demo data must succeed after CSRF probe.");
    requireAuditUnchanged(auditBefore, countAuditActions(result.payload.audit_entries), "customer_created");

    const secondTenantCookie = await login(baseUrl, secondTenantSalesEmail, password);
    result = await requestJson(baseUrl, "/api/supabase/demo-data?company_id=browser-supplied-primary", {
      method: "GET",
      headers: { Cookie: secondTenantCookie }
    }, "second tenant demo-data");
    requireSafe(result.response.ok, "Second tenant demo data must succeed.");
    requireSafe(
      result.payload.company?.name !== primaryDemoData.company?.name,
      "Second tenant demo data must use its own session company."
    );
    requireSafe(
      result.payload.projects?.some((item) => item.id === secondTenantProjectId),
      "Second tenant demo data must include its own project."
    );
    requireSafe(
      !result.payload.projects?.some((item) => item.id === demoProjectId),
      "Second tenant demo data must not include the primary tenant project."
    );
    requireSafe(
      !primaryDemoData.projects?.some((item) => item.id === secondTenantProjectId),
      "Primary tenant demo data must not include the second tenant project."
    );

    const secondTenantReadProbes = [
      {
        label: "second tenant reads primary project detail",
        path: `/api/supabase/projects/${demoProjectId}`
      },
      {
        label: "second tenant reads primary project quote list",
        path: `/api/supabase/projects/${demoProjectId}/quote-revisions`
      },
      {
        label: "second tenant reads primary quote revision",
        path: `/api/supabase/quote-revisions/${demoQuoteRevisionId}`
      },
      {
        label: "second tenant reads primary configuration draft",
        path: `/api/supabase/quote-revisions/${demoQuoteRevisionId}/configuration-draft`
      },
      {
        label: "second tenant reads primary quote snapshot",
        path: `/api/supabase/quote-revisions/${demoQuoteRevisionId}/snapshot`
      },
      {
        label: "second tenant reads primary quote documents",
        path: `/api/supabase/quote-revisions/${demoQuoteRevisionId}/documents`
      },
      {
        label: "second tenant reads primary quote document metadata",
        path: `/api/supabase/documents/${demoDocumentId}`
      },
      {
        label: "second tenant reads primary quote document artifact",
        path: `/api/supabase/documents/${demoDocumentId}/preview`
      },
      {
        label: "second tenant reads primary approval status",
        path: `/api/supabase/quote-revisions/${demoQuoteRevisionId}/approval-status`
      },
      {
        label: "second tenant reads primary revision diff",
        path: `/api/supabase/quote-revisions/${demoQuoteRevisionId}/diff?against=${demoApprovedQuoteRevisionId}`
      },
      {
        label: "primary tenant reads second project detail",
        path: `/api/supabase/projects/${secondTenantProjectId}`,
        cookie: salesCookie
      },
      {
        label: "primary tenant reads second project quote list",
        path: `/api/supabase/projects/${secondTenantProjectId}/quote-revisions`,
        cookie: salesCookie
      },
      {
        label: "primary tenant reads second quote revision",
        path: `/api/supabase/quote-revisions/${secondTenantQuoteRevisionId}`,
        cookie: salesCookie
      },
      {
        label: "primary tenant reads second configuration draft",
        path: `/api/supabase/quote-revisions/${secondTenantQuoteRevisionId}/configuration-draft`,
        cookie: salesCookie
      },
      {
        label: "primary tenant reads second quote snapshot",
        path: `/api/supabase/quote-revisions/${secondTenantQuoteRevisionId}/snapshot`,
        cookie: salesCookie
      },
      {
        label: "primary tenant reads second quote documents",
        path: `/api/supabase/quote-revisions/${secondTenantQuoteRevisionId}/documents`,
        cookie: salesCookie
      },
      {
        label: "primary tenant reads second approval status",
        path: `/api/supabase/quote-revisions/${secondTenantQuoteRevisionId}/approval-status`,
        cookie: salesCookie
      },
      {
        label: "primary tenant reads second revision diff",
        path: `/api/supabase/quote-revisions/${secondTenantQuoteRevisionId}/diff?against=${secondTenantQuoteRevisionId}`,
        cookie: salesCookie
      }
    ];
    for (const probe of secondTenantReadProbes) {
      result = await requestJson(baseUrl, probe.path, {
        method: "GET",
        headers: { Cookie: probe.cookie || secondTenantCookie }
      }, probe.label);
      requireSafe(result.response.status === 404, `${probe.label} must return tenant-scoped 404.`);
    }

    const secondTenantWriteProbes = [
      {
        label: "second tenant project create with primary customer",
        path: "/api/supabase/projects",
        method: "POST",
        body: { ...forgedPayloadMarkers, customer_id: demoCustomerId, name: `Cross Tenant Project ${suffix}` }
      },
      {
        label: "second tenant quote draft on primary project",
        path: `/api/supabase/projects/${demoProjectId}/quote-drafts`,
        method: "POST",
        body: { ...forgedPayloadMarkers, status: "sent" }
      },
      {
        label: "second tenant configuration create on primary revision",
        path: `/api/supabase/quote-revisions/${demoQuoteRevisionId}/configuration-draft`,
        method: "POST",
        body: configurationDraftBody()
      },
      {
        label: "second tenant calculate primary revision",
        path: `/api/supabase/quote-revisions/${demoQuoteRevisionId}/calculate`,
        method: "POST",
        body: { expected_configuration_version: 1 }
      },
      {
        label: "second tenant document primary revision",
        path: `/api/supabase/quote-revisions/${demoQuoteRevisionId}/documents`,
        method: "POST",
        body: {}
      },
      {
        label: "second tenant fork primary revision",
        path: `/api/supabase/quote-revisions/${demoQuoteRevisionId}/fork`,
        method: "POST",
        body: { expected_revision_version: 1 }
      }
    ];
    for (const probe of secondTenantWriteProbes) {
      result = await requestJson(baseUrl, probe.path, {
        method: probe.method,
        headers: {
          "Content-Type": "application/json",
          Cookie: secondTenantCookie,
          "x-idempotency-key": `second-tenant-${probe.label.replaceAll(" ", "-")}-${suffix}`
        },
        body: JSON.stringify(probe.body)
      }, probe.label);
      requireSafe(result.response.status === 404, `${probe.label} must return tenant-scoped 404.`);
    }
    const primaryToSecondTenantWriteProbes = [
      {
        label: "primary tenant project create with second tenant customer",
        path: "/api/supabase/projects",
        method: "POST",
        body: { ...forgedPayloadMarkers, customer_id: secondTenantCustomerId, name: `Cross Tenant B Project ${suffix}` }
      },
      {
        label: "primary tenant quote draft on second tenant project",
        path: `/api/supabase/projects/${secondTenantProjectId}/quote-drafts`,
        method: "POST",
        body: { ...forgedPayloadMarkers, status: "sent" }
      },
      {
        label: "primary tenant configuration create on second tenant revision",
        path: `/api/supabase/quote-revisions/${secondTenantQuoteRevisionId}/configuration-draft`,
        method: "POST",
        body: configurationDraftBody()
      },
      {
        label: "primary tenant calculate second tenant revision",
        path: `/api/supabase/quote-revisions/${secondTenantQuoteRevisionId}/calculate`,
        method: "POST",
        body: { expected_configuration_version: 1 }
      },
      {
        label: "primary tenant document second tenant revision",
        path: `/api/supabase/quote-revisions/${secondTenantQuoteRevisionId}/documents`,
        method: "POST",
        body: {}
      },
      {
        label: "primary tenant fork second tenant revision",
        path: `/api/supabase/quote-revisions/${secondTenantQuoteRevisionId}/fork`,
        method: "POST",
        body: { expected_revision_version: 1 }
      }
    ];
    for (const probe of primaryToSecondTenantWriteProbes) {
      result = await requestJson(baseUrl, probe.path, {
        method: probe.method,
        headers: {
          "Content-Type": "application/json",
          Cookie: salesCookie,
          "x-idempotency-key": `primary-to-second-tenant-${probe.label.replaceAll(" ", "-")}-${suffix}`
        },
        body: JSON.stringify(probe.body)
      }, probe.label);
      requireSafe(result.response.status === 404, `${probe.label} must return tenant-scoped 404.`);
    }
    result = await requestJson(baseUrl, "/api/supabase/demo-data", {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "audit after second tenant IDOR probes");
    requireSafe(result.response.ok, "Demo data must succeed after second tenant IDOR probes.");
    const auditAfterSecondTenantIdor = countAuditActions(result.payload.audit_entries);
    requireAuditUnchanged(auditBefore, auditAfterSecondTenantIdor, "project_created");
    requireAuditUnchanged(auditBefore, auditAfterSecondTenantIdor, "quote_draft_created");
    requireAuditUnchanged(auditBefore, auditAfterSecondTenantIdor, "quote_configuration_created");
    requireAuditUnchanged(auditBefore, auditAfterSecondTenantIdor, "quote_snapshot_calculated");

    const idorProbes = [
      {
        label: "missing customer project create",
        path: "/api/supabase/projects",
        method: "POST",
        body: { ...forgedPayloadMarkers, customer_id: fakeCustomerId, name: `Missing Customer Project ${suffix}` }
      },
      {
        label: "missing project detail",
        path: `/api/supabase/projects/${fakeProjectId}`,
        method: "GET"
      },
      {
        label: "missing project quote list",
        path: `/api/supabase/projects/${fakeProjectId}/quote-revisions`,
        method: "GET"
      },
      {
        label: "missing project quote draft",
        path: `/api/supabase/projects/${fakeProjectId}/quote-drafts`,
        method: "POST",
        body: { ...forgedPayloadMarkers, status: "sent" }
      },
      {
        label: "missing quote revision read",
        path: `/api/supabase/quote-revisions/${fakeQuoteRevisionId}`,
        method: "GET"
      },
      {
        label: "missing configuration draft read",
        path: `/api/supabase/quote-revisions/${fakeQuoteRevisionId}/configuration-draft`,
        method: "GET"
      },
      {
        label: "missing configuration draft create",
        path: `/api/supabase/quote-revisions/${fakeQuoteRevisionId}/configuration-draft`,
        method: "POST",
        body: configurationDraftBody()
      },
      {
        label: "missing configuration draft update",
        path: `/api/supabase/quote-revisions/${fakeQuoteRevisionId}/configuration-draft`,
        method: "PATCH",
        body: configurationDraftBody({ expected_version: 1, width_mm: 1900 })
      },
      {
        label: "missing quote snapshot read",
        path: `/api/supabase/quote-revisions/${fakeQuoteRevisionId}/snapshot`,
        method: "GET"
      },
      {
        label: "missing quote calculate",
        path: `/api/supabase/quote-revisions/${fakeQuoteRevisionId}/calculate`,
        method: "POST",
        body: { expected_configuration_version: 1 }
      }
    ];
    for (const probe of idorProbes) {
      result = await requestJson(baseUrl, probe.path, {
        method: probe.method,
        headers: {
          "Content-Type": "application/json",
          Cookie: salesCookie,
          "x-idempotency-key": `idor-${probe.label.replaceAll(" ", "-")}-${suffix}`
        },
        body: probe.method === "GET" ? undefined : JSON.stringify(probe.body ?? forgedPayloadMarkers)
      }, probe.label);
      requireSafe(
        result.response.status === 404,
        `${probe.label} must return tenant-scoped 404, got ${result.response.status}.`
      );
    }

    const customerBody = {
      ...forgedPayloadMarkers,
      name: `Smoke Customer ${suffix}`,
      email: `smoke-${suffix}@example.local`,
      phone: "+90 555 010 10 10"
    };

    result = await requestJson(baseUrl, "/api/supabase/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": customerKey },
      body: JSON.stringify(customerBody)
    }, "customer create");
    requireSafe(result.response.status === 201, "Sales customer create must return 201.");
    const customer = result.payload.customer;
    requireSafe(Boolean(customer?.id), "Customer create payload must include a safe id.");

    await stopNextServer(child);
    ({ baseUrl, child } = await startNextServer());

    result = await requestJson(baseUrl, "/api/supabase/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": customerKey },
      body: JSON.stringify(customerBody)
    }, "customer durable idempotency replay after restart");
    requireSafe(result.response.status === 201, "Customer durable replay after restart must return the stored status.");
    requireSafe(result.payload.customer?.id === customer.id, "Customer durable replay after restart must return the original safe result.");

    result = await requestJson(baseUrl, "/api/supabase/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: secondTenantCookie, "x-idempotency-key": customerKey },
      body: JSON.stringify({
        ...forgedPayloadMarkers,
        name: `Tenant B Smoke Customer ${suffix}`,
        email: `tenantb-smoke-${suffix}@example.local`,
        phone: "+90 555 030 30 30"
      })
    }, "second tenant customer create with primary tenant key");
    requireSafe(result.response.status === 201, "Second tenant customer create must return 201.");
    requireSafe(Boolean(result.payload.customer?.id), "Second tenant customer create payload must include a safe id.");
    requireSafe(result.payload.customer.id !== customer.id, "Idempotency key reuse across tenants must not replay another tenant's result.");

    const adminCookie = await login(baseUrl, "admin@demo.local", password);
    const adminCustomerBody = {
      ...forgedPayloadMarkers,
      name: `Admin Smoke Customer ${suffix}`,
      email: `admin-smoke-${suffix}@example.local`,
      phone: "+90 555 020 20 20"
    };
    result = await requestJson(baseUrl, "/api/supabase/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie, "x-idempotency-key": customerKey },
      body: JSON.stringify(adminCustomerBody)
    }, "admin customer create with sales key");
    requireSafe(result.response.status === 201, "Admin customer create must return 201.");
    const adminCustomer = result.payload.customer;
    requireSafe(Boolean(adminCustomer?.id), "Admin customer create payload must include a safe id.");
    requireSafe(adminCustomer.id !== customer.id, "Idempotency key reuse across users must not replay another actor's result.");

    result = await requestJson(baseUrl, "/api/supabase/demo-data", {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "customer audit after creates");
    requireSafe(result.response.ok, "Demo data must succeed after customer creates.");
    const auditAfterCustomerCreates = countAuditActions(result.payload.audit_entries);
    requireAuditDelta(auditBefore, auditAfterCustomerCreates, "customer_created", 2);

    result = await requestJson(baseUrl, "/api/supabase/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": customerKey },
      body: JSON.stringify(customerBody)
    }, "customer idempotency replay");
    requireSafe(result.response.status === 201, "Customer idempotency replay must return the stored status.");
    requireSafe(result.payload.customer?.id === customer.id, "Customer idempotency replay must return the original safe result.");

    result = await requestJson(baseUrl, "/api/supabase/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": customerKey },
      body: JSON.stringify({ ...customerBody, name: `${customerBody.name} Conflict` })
    }, "customer idempotency conflict");
    requireSafe(result.response.status === 409, "Customer idempotency conflict must return 409.");

    result = await requestJson(baseUrl, "/api/supabase/demo-data", {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "customer audit after idempotency checks");
    requireSafe(result.response.ok, "Demo data must succeed after customer idempotency checks.");
    const auditAfterCustomerIdempotency = countAuditActions(result.payload.audit_entries);
    requireAuditUnchanged(auditAfterCustomerCreates, auditAfterCustomerIdempotency, "customer_created");

    const projectBody = {
      customer_id: customer.id,
      name: `Smoke Project ${suffix}`,
      company_id: "browser-supplied"
    };
    result = await requestJson(baseUrl, "/api/supabase/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": projectKey },
      body: JSON.stringify(projectBody)
    }, "project create");
    requireSafe(result.response.status === 201, "Sales project create must return 201.");
    const project = result.payload.project;
    requireSafe(Boolean(project?.id), "Project create payload must include a safe id.");
    requireSafe(project.status === "draft", "Project create payload must be draft.");
    requireSafe(!("company_id" in project), "Project payload must not expose company_id.");

    result = await requestJson(baseUrl, "/api/supabase/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie, "x-idempotency-key": projectKey },
      body: JSON.stringify({ ...forgedPayloadMarkers, customer_id: adminCustomer.id, name: `Admin Smoke Project ${suffix}` })
    }, "admin project create with sales key");
    requireSafe(result.response.status === 201, "Admin project create must return 201.");
    const adminProject = result.payload.project;
    requireSafe(Boolean(adminProject?.id), "Admin project create payload must include a safe id.");
    requireSafe(adminProject.id !== project.id, "Project idempotency key reuse across users must not replay another actor's result.");

    result = await requestJson(baseUrl, "/api/supabase/demo-data", {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "project audit after creates");
    requireSafe(result.response.ok, "Demo data must succeed after project creates.");
    const auditAfterProjectCreates = countAuditActions(result.payload.audit_entries);
    requireAuditDelta(auditAfterCustomerIdempotency, auditAfterProjectCreates, "project_created", 2);

    result = await requestJson(baseUrl, "/api/supabase/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": projectKey },
      body: JSON.stringify(projectBody)
    }, "project idempotency replay");
    requireSafe(result.response.status === 201, "Project idempotency replay must return the stored status.");
    requireSafe(result.payload.project?.id === project.id, "Project idempotency replay must return the original safe result.");

    result = await requestJson(baseUrl, "/api/supabase/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": projectKey },
      body: JSON.stringify({ ...projectBody, name: `${projectBody.name} Conflict` })
    }, "project idempotency conflict");
    requireSafe(result.response.status === 409, "Project idempotency conflict must return 409.");

    result = await requestJson(baseUrl, "/api/supabase/demo-data", {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "project audit after idempotency checks");
    requireSafe(result.response.ok, "Demo data must succeed after project idempotency checks.");
    const auditAfterProjectIdempotency = countAuditActions(result.payload.audit_entries);
    requireAuditUnchanged(auditAfterProjectCreates, auditAfterProjectIdempotency, "project_created");

    result = await requestJson(baseUrl, `/api/supabase/projects/${project.id}`, {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "project detail before quote");
    requireSafe(result.response.ok, "Project detail must succeed for session project.");
    requireSafe(result.payload.project?.id === project.id, "Project detail must return the requested project.");
    requireSafe(Array.isArray(result.payload.quote_revisions), "Project detail must include a quote revision timeline array.");
    assertAuditTimelineShape(result.payload.audit_entries, "Project detail before quote");

    const quoteDraftBody = { company_id: "browser-supplied", status: "sent" };
    result = await requestJson(baseUrl, `/api/supabase/projects/${project.id}/quote-drafts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": quoteDraftKey },
      body: JSON.stringify(quoteDraftBody)
    }, "quote draft create");
    requireSafe(result.response.status === 201, "Sales quote draft create must return 201.");
    const quoteRevision = result.payload.quote_revision;
    requireSafe(Boolean(quoteRevision?.id), `Quote draft payload must include a safe id. Payload keys: ${Object.keys(result.payload).join(",")}; quote_revision keys: ${quoteRevision ? Object.keys(quoteRevision).join(",") : "missing"}.`);
    assertQuoteDraftDeferred(result.payload, "quote draft create");

    result = await requestJson(baseUrl, `/api/supabase/projects/${adminProject.id}/quote-drafts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie, "x-idempotency-key": quoteDraftKey },
      body: JSON.stringify({ ...forgedPayloadMarkers, status: "sent" })
    }, "admin quote draft create with sales key");
    requireSafe(result.response.status === 201, "Admin quote draft create must return 201.");
    requireSafe(Boolean(result.payload.quote_revision?.id), "Admin quote draft payload must include a safe id.");
    const adminQuoteRevision = result.payload.quote_revision;
    requireSafe(result.payload.quote_revision.id !== quoteRevision.id, "Quote draft idempotency key reuse across users must not replay another actor's result.");
    assertQuoteDraftDeferred(result.payload, "admin quote draft create");

    result = await requestJson(baseUrl, "/api/supabase/demo-data", {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "quote audit after creates");
    requireSafe(result.response.ok, "Demo data must succeed after quote draft creates.");
    const auditAfterQuoteCreates = countAuditActions(result.payload.audit_entries);
    requireAuditDelta(auditAfterProjectIdempotency, auditAfterQuoteCreates, "quote_draft_created", 2);

    result = await requestJson(baseUrl, `/api/supabase/projects/${project.id}/quote-drafts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": quoteDraftKey },
      body: JSON.stringify(quoteDraftBody)
    }, "quote draft idempotency replay");
    requireSafe(result.response.status === 201, "Quote draft idempotency replay must return the stored status.");
    requireSafe(result.payload.quote_revision?.id === quoteRevision.id, "Quote draft idempotency replay must return the original result.");

    result = await requestJson(baseUrl, `/api/supabase/projects/${project.id}/quote-drafts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": quoteDraftKey },
      body: JSON.stringify({ ...quoteDraftBody, status: "approved" })
    }, "quote draft idempotency conflict");
    requireSafe(result.response.status === 409, "Quote draft idempotency conflict must return 409.");

    result = await requestJson(baseUrl, "/api/supabase/demo-data", {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "quote audit after idempotency checks");
    requireSafe(result.response.ok, "Demo data must succeed after quote idempotency checks.");
    const auditAfterQuoteIdempotency = countAuditActions(result.payload.audit_entries);
    requireAuditUnchanged(auditAfterQuoteCreates, auditAfterQuoteIdempotency, "quote_draft_created");

    result = await requestJson(baseUrl, `/api/supabase/projects/${project.id}/quote-revisions`, {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "quote revision list");
    requireSafe(result.response.ok, "Quote revision list must succeed.");
    requireSafe(
      result.payload.quote_revisions.some((item) => item.id === quoteRevision.id),
      "Quote revision list must include the created draft."
    );

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}`, {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "quote revision get");
    requireSafe(result.response.ok, "Quote revision get must succeed.");
    requireSafe(result.payload.quote_revision?.status === "draft", "Quote revision get must return draft status.");
    requireSafe(result.payload.status_policy?.status === "draft", "Quote revision detail must include draft status policy.");
    requireSafe(result.payload.status_policy?.direct_status_update_allowed === false, "Direct quote status writes must be blocked.");
    assertAuditTimelineShape(result.payload.audit_entries, "Quote revision detail");

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/configuration-draft`, {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "configuration draft read before create");
    requireSafe(result.response.ok, "Configuration draft read before create must succeed.");
    requireSafe(result.payload.configuration_draft === null, "Configuration draft read before create must return null draft.");
    requireSafe(result.payload.calculation_status === "not_calculated", "Configuration draft read must not report calculated state.");

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/snapshot`, {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "quote snapshot read before configuration");
    requireSafe(result.response.ok, "Quote snapshot read before configuration must succeed.");
    assertQuoteSnapshotNotCalculated(result.payload, "quote snapshot read before configuration");

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/calculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": `missing-config-calculate-${suffix}` },
      body: JSON.stringify({ expected_configuration_version: 1 })
    }, "quote calculate before configuration");
    requireSafe(result.response.status === 422, "Quote calculate before configuration must require a saved configuration draft.");

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/configuration-draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie },
      body: JSON.stringify(configurationDraftBody())
    }, "configuration draft create without idempotency");
    requireSafe(result.response.status === 422, "Configuration draft create without idempotency must return 422.");

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/configuration-draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": `invalid-config-${suffix}` },
      body: JSON.stringify(configurationDraftBody({ width_mm: 1800.5 }))
    }, "configuration draft invalid dimension");
    requireSafe(result.response.status === 422, "Configuration draft invalid dimension must return 422.");

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${demoApprovedQuoteRevisionId}/configuration-draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": `approved-config-create-${suffix}` },
      body: JSON.stringify(configurationDraftBody())
    }, "approved revision configuration draft create");
    requireSafe(result.response.status === 409, "Approved revision configuration draft create must return 409.");

    const configBody = configurationDraftBody();
    const expectedConfig = {
      width_mm: 1800,
      height_mm: 2200,
      depth_mm: 600,
      quantity: 1,
      door_count: 3,
      shelf_count: 4,
      material_sku: "MDF-LAM-BEYAZ-18",
      edge_band_sku: "PVC-BEYAZ-1MM"
    };
    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/configuration-draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": configCreateKey },
      body: JSON.stringify(configBody)
    }, "configuration draft create");
    requireSafe(result.response.status === 201, "Configuration draft create must return 201.");
    const configurationDraft = result.payload.configuration_draft;
    assertConfigurationDraftDeferred(result.payload, expectedConfig, "configuration draft create");

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${adminQuoteRevision.id}/configuration-draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie, "x-idempotency-key": configCreateKey },
      body: JSON.stringify(configurationDraftBody({ notes: "Admin config actor isolation" }))
    }, "admin configuration draft create with sales key");
    requireSafe(result.response.status === 201, "Admin configuration draft create must return 201.");
    requireSafe(result.payload.configuration_draft?.id !== configurationDraft.id, "Configuration idempotency key reuse across users must not replay another actor's result.");
    assertConfigurationDraftDeferred(result.payload, expectedConfig, "admin configuration draft create");

    result = await requestJson(baseUrl, "/api/supabase/demo-data", {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "configuration audit after creates");
    requireSafe(result.response.ok, "Demo data must succeed after configuration draft creates.");
    const auditAfterConfigurationCreates = countAuditActions(result.payload.audit_entries);
    requireAuditDelta(auditAfterQuoteIdempotency, auditAfterConfigurationCreates, "quote_configuration_created", 2);

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/configuration-draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": configCreateKey },
      body: JSON.stringify(configBody)
    }, "configuration draft idempotency replay");
    requireSafe(result.response.status === 201, "Configuration draft replay must return the stored status.");
    requireSafe(result.payload.configuration_draft?.id === configurationDraft.id, "Configuration draft replay must return the original draft.");
    assertConfigurationDraftDeferred(result.payload, expectedConfig, "configuration draft replay");

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/configuration-draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": configCreateKey },
      body: JSON.stringify(configurationDraftBody({ width_mm: 1900 }))
    }, "configuration draft idempotency conflict");
    requireSafe(result.response.status === 409, "Configuration draft idempotency conflict must return 409.");

    result = await requestJson(baseUrl, "/api/supabase/demo-data", {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "configuration audit after create idempotency checks");
    requireSafe(result.response.ok, "Demo data must succeed after configuration idempotency checks.");
    const auditAfterConfigurationCreateIdempotency = countAuditActions(result.payload.audit_entries);
    requireAuditUnchanged(auditAfterConfigurationCreates, auditAfterConfigurationCreateIdempotency, "quote_configuration_created");

    const updateBody = configurationDraftBody({
      expected_version: configurationDraft.version,
      width_mm: 1900,
      quantity: 2,
      notes: "Updated smoke test wardrobe draft"
    });
    const expectedUpdatedConfig = { ...expectedConfig, width_mm: 1900, quantity: 2 };
    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/configuration-draft`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": configUpdateKey },
      body: JSON.stringify(updateBody)
    }, "configuration draft update");
    requireSafe(result.response.status === 200, "Configuration draft update must return 200.");
    requireSafe(result.payload.configuration_draft?.id === configurationDraft.id, "Configuration draft update must preserve draft id.");
    requireSafe(result.payload.configuration_draft?.version === configurationDraft.version + 1, "Configuration draft update must increment version.");
    assertConfigurationDraftDeferred(result.payload, expectedUpdatedConfig, "configuration draft update");
    const updatedConfigurationDraft = result.payload.configuration_draft;

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/configuration-draft`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": `stale-config-update-${suffix}` },
      body: JSON.stringify(configurationDraftBody({ expected_version: configurationDraft.version, width_mm: 2000 }))
    }, "configuration draft stale update");
    requireSafe(result.response.status === 409, "Configuration draft stale update must return 409.");

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/configuration-draft`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": `invalid-config-update-${suffix}` },
      body: JSON.stringify(configurationDraftBody({ expected_version: updatedConfigurationDraft.version, quantity: 1.5 }))
    }, "configuration draft invalid update quantity");
    requireSafe(result.response.status === 422, "Configuration draft invalid update quantity must return 422.");

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${demoApprovedQuoteRevisionId}/configuration-draft`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": `approved-config-update-${suffix}` },
      body: JSON.stringify(configurationDraftBody({ expected_version: 1, width_mm: 1900 }))
    }, "approved revision configuration draft update");
    requireSafe([404, 409, 422].includes(result.response.status), "Approved revision configuration draft update must not succeed.");

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/configuration-draft`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": configUpdateKey },
      body: JSON.stringify(updateBody)
    }, "configuration draft update idempotency replay");
    requireSafe(result.response.status === 200, "Configuration draft update replay must return the stored status.");
    requireSafe(result.payload.configuration_draft?.version === updatedConfigurationDraft.version, "Configuration draft update replay must not increment version again.");
    assertConfigurationDraftDeferred(result.payload, expectedUpdatedConfig, "configuration draft update replay");

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/configuration-draft`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": configUpdateKey },
      body: JSON.stringify(configurationDraftBody({ expected_version: updatedConfigurationDraft.version, width_mm: 2100 }))
    }, "configuration draft update idempotency conflict");
    requireSafe(result.response.status === 409, "Configuration draft update idempotency conflict must return 409.");

    result = await requestJson(baseUrl, "/api/supabase/demo-data", {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "configuration audit after update checks");
    requireSafe(result.response.ok, "Demo data must succeed after configuration update checks.");
    const auditAfterConfigurationUpdates = countAuditActions(result.payload.audit_entries);
    requireAuditDelta(auditAfterConfigurationCreateIdempotency, auditAfterConfigurationUpdates, "quote_configuration_updated", 1);

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/configuration-draft`, {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "configuration draft read after update");
    requireSafe(result.response.ok, "Configuration draft read after update must succeed.");
    requireSafe(result.payload.configuration_draft?.version === updatedConfigurationDraft.version, "Configuration draft read after update must return current version.");
    assertConfigurationDraftDeferred(result.payload, expectedUpdatedConfig, "configuration draft read after update");

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/snapshot`, {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "quote snapshot read before calculate");
    requireSafe(result.response.ok, "Quote snapshot read before calculate must succeed.");
    assertQuoteSnapshotNotCalculated(result.payload, "quote snapshot read before calculate");

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": `pre-calc-document-${suffix}` },
      body: JSON.stringify({})
    }, "quote document before calculate");
    requireSafe([409, 422].includes(result.response.status), "Quote document generation before calculation must not succeed.");

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/calculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie },
      body: JSON.stringify({ expected_configuration_version: updatedConfigurationDraft.version })
    }, "quote calculate without idempotency");
    requireSafe(result.response.status === 422, "Quote calculate without idempotency must return 422.");

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/calculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": `forged-calculate-${suffix}` },
      body: JSON.stringify({
        ...forgedPayloadMarkers,
        expected_configuration_version: updatedConfigurationDraft.version,
        status: "sent",
        quote_total: { grand_total_minor: 1 },
        cost_snapshot: { grand_total_minor: 1 },
        bom_snapshot: { part_count: 1 }
      })
    }, "quote calculate with browser forged authority");
    requireSafe(result.response.status === 422, "Quote calculate with browser forged authority must return 422.");

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/configuration-draft`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": `slice-invalid-config-${suffix}` },
      body: JSON.stringify(configurationDraftBody({
        expected_version: updatedConfigurationDraft.version,
        width_mm: 500,
        quantity: 2,
        notes: "Slice-invalid wardrobe dimensions"
      }))
    }, "configuration draft slice-invalid update");
    requireSafe(result.response.status === 200, "Configuration draft slice-invalid update must pass generic draft validation.");
    const sliceInvalidConfigurationDraft = result.payload.configuration_draft;
    assertConfigurationDraftDeferred(result.payload, { ...expectedUpdatedConfig, width_mm: 500 }, "configuration draft slice-invalid update");

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/calculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": `slice-invalid-calculate-${suffix}` },
      body: JSON.stringify({ expected_configuration_version: sliceInvalidConfigurationDraft.version })
    }, "quote calculate slice-invalid configuration");
    requireSafe(result.response.status === 422, "Quote calculate must reject dimensions outside the deterministic wardrobe slice.");

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/configuration-draft`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": `restore-valid-config-${suffix}` },
      body: JSON.stringify(configurationDraftBody({
        expected_version: sliceInvalidConfigurationDraft.version,
        width_mm: 1900,
        quantity: 2,
        notes: "Restored calculable smoke test wardrobe draft"
      }))
    }, "configuration draft restore calculable update");
    requireSafe(result.response.status === 200, "Configuration draft restore calculable update must return 200.");
    const calculableConfigurationDraft = result.payload.configuration_draft;
    assertConfigurationDraftDeferred(result.payload, expectedUpdatedConfig, "configuration draft restore calculable update");

    result = await requestJson(baseUrl, "/api/supabase/demo-data", {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "audit before quote calculation");
    requireSafe(result.response.ok, "Demo data must succeed before quote calculation.");
    const auditBeforeQuoteCalculation = countAuditActions(result.payload.audit_entries);

    const calculateKey = `quote-calculate-${suffix}`;
    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/calculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": calculateKey },
      body: JSON.stringify({ expected_configuration_version: calculableConfigurationDraft.version })
    }, "quote calculate persisted snapshot");
    requireSafe(result.response.status === 201, "Quote calculate must persist a deterministic snapshot.");
    assertQuoteSnapshotCalculated(result.payload, {
      quoteRevisionId: quoteRevision.id,
      configurationDraftId: calculableConfigurationDraft.id,
      configurationVersion: calculableConfigurationDraft.version,
      quantity: expectedUpdatedConfig.quantity
    }, "quote calculate persisted snapshot");
    const calculatedBomSnapshot = result.payload.bom_snapshot;
    const calculatedCostSnapshot = result.payload.cost_snapshot;

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/calculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": calculateKey },
      body: JSON.stringify({ expected_configuration_version: calculableConfigurationDraft.version })
    }, "quote calculate idempotency replay");
    requireSafe(result.response.status === 201, "Quote calculate idempotency replay must return the stored status.");
    assertQuoteSnapshotCalculated(result.payload, {
      quoteRevisionId: quoteRevision.id,
      configurationDraftId: calculableConfigurationDraft.id,
      configurationVersion: calculableConfigurationDraft.version,
      quantity: expectedUpdatedConfig.quantity
    }, "quote calculate idempotency replay");
    requireSafe(result.payload.bom_snapshot.id === calculatedBomSnapshot.id, "Quote calculate replay must return the original BOM snapshot id.");
    requireSafe(result.payload.cost_snapshot.id === calculatedCostSnapshot.id, "Quote calculate replay must return the original cost snapshot id.");
    requireSafe(result.payload.bom_snapshot.snapshot_hash === calculatedBomSnapshot.snapshot_hash, "Quote calculate replay must preserve the BOM snapshot hash.");
    requireSafe(result.payload.cost_snapshot.snapshot_hash === calculatedCostSnapshot.snapshot_hash, "Quote calculate replay must preserve the cost snapshot hash.");

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/calculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": calculateKey },
      body: JSON.stringify({ expected_configuration_version: calculableConfigurationDraft.version, idempotency_key: `conflicting-body-${suffix}` })
    }, "quote calculate idempotency conflict");
    requireSafe(result.response.status === 409, "Quote calculate idempotency conflict must return 409.");

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/snapshot`, {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "quote snapshot read after calculate");
    requireSafe(result.response.ok, "Quote snapshot read after calculate must succeed.");
    assertQuoteSnapshotCalculated(result.payload, {
      quoteRevisionId: quoteRevision.id,
      configurationDraftId: calculableConfigurationDraft.id,
      configurationVersion: calculableConfigurationDraft.version,
      quantity: expectedUpdatedConfig.quantity
    }, "quote snapshot read after calculate");
    requireSafe(result.payload.bom_snapshot.snapshot_hash === calculatedBomSnapshot.snapshot_hash, "Snapshot read must return the calculated BOM hash.");
    requireSafe(result.payload.cost_snapshot.snapshot_hash === calculatedCostSnapshot.snapshot_hash, "Snapshot read must return the calculated cost hash.");

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${demoApprovedQuoteRevisionId}/calculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": `approved-calculate-${suffix}` },
      body: JSON.stringify({ expected_configuration_version: 1 })
    }, "approved revision quote calculate");
    requireSafe(result.response.status === 409, "Approved revision quote calculate must not succeed.");

    result = await requestJson(baseUrl, "/api/supabase/demo-data", {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "audit after quote calculation");
    requireSafe(result.response.ok, "Demo data must succeed after quote calculation.");
    const auditAfterQuoteCalculation = countAuditActions(result.payload.audit_entries);
    requireAuditDelta(auditBeforeQuoteCalculation, auditAfterQuoteCalculation, "quote_snapshot_calculated", 1);

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": `forged-document-${suffix}` },
      body: JSON.stringify({
        ...forgedPayloadMarkers,
        grand_total_minor: 1,
        snapshot_hash: "browser-supplied",
        document_hash: "browser-supplied",
        token_hash: "browser-supplied"
      })
    }, "quote document forged authority");
    requireSafe(result.response.status === 422, "Quote document generation must reject forged authoritative fields.");

    result = await requestJson(baseUrl, "/api/supabase/demo-data", {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "audit before quote document");
    requireSafe(result.response.ok, "Demo data must succeed before quote document generation.");
    const auditBeforeQuoteDocument = countAuditActions(result.payload.audit_entries);

    const documentKey = `quote-document-${suffix}`;
    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": documentKey },
      body: JSON.stringify({})
    }, "quote document generate");
    requireSafe(result.response.status === 201, "Quote document generation must return 201.");
    assertFrozenQuoteDocument(result.payload, {
      quoteRevisionId: quoteRevision.id,
      quoteRevisionVersion: quoteRevision.version,
      costSnapshotId: calculatedCostSnapshot.id,
      costSnapshotHash: calculatedCostSnapshot.snapshot_hash,
      grandTotalMinor: calculatedCostSnapshot.grand_total_minor,
      currency: calculatedCostSnapshot.currency
    }, "quote document generate");
    const generatedDocument = result.payload.document;

    const generatedArtifact = await requestText(baseUrl, `/api/supabase/documents/${generatedDocument.id}/preview`, {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "quote document artifact preview after generate");
    requireSafe(generatedArtifact.response.ok, "Quote document artifact preview must succeed.");
    requireSafe(
      (generatedArtifact.response.headers.get("cache-control") || "").includes("no-store"),
      "Quote document artifact preview must be no-store."
    );
    requireSafe(
      (generatedArtifact.response.headers.get("x-content-type-options") || "").toLowerCase() === "nosniff",
      "Quote document artifact preview must set nosniff."
    );
    requireSafe(
      (generatedArtifact.response.headers.get("content-security-policy") || "").includes("sandbox"),
      "Quote document artifact preview must set sandboxed CSP."
    );
    assertFrozenQuoteDocumentArtifact(generatedArtifact.text, {
      costSnapshotHash: calculatedCostSnapshot.snapshot_hash,
      grandTotalMinor: calculatedCostSnapshot.grand_total_minor,
      currency: calculatedCostSnapshot.currency
    }, "quote document artifact preview after generate");

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": documentKey },
      body: JSON.stringify({})
    }, "quote document idempotency replay");
    requireSafe(result.response.status === 201, "Quote document replay must return the stored status.");
    requireSafe(result.payload.document?.id === generatedDocument.id, "Quote document replay must return original document id.");
    requireSafe(result.payload.document?.sha256 === generatedDocument.sha256, "Quote document replay must return original hash.");

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": documentKey },
      body: JSON.stringify({ idempotency_key: `conflicting-document-${suffix}` })
    }, "quote document idempotency conflict");
    requireSafe(result.response.status === 409, "Quote document idempotency conflict must return 409.");

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/documents`, {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "quote document list");
    requireSafe(result.response.ok, "Quote document list must succeed.");
    requireSafe(
      result.payload.documents?.some((document) => document.id === generatedDocument.id),
      "Quote document list must include generated document."
    );
    assertNoForbiddenResponseFields("quote document list", result.payload);

    result = await requestJson(baseUrl, `/api/supabase/documents/${generatedDocument.id}`, {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "quote document metadata get");
    requireSafe(result.response.ok, "Quote document metadata get must succeed.");
    assertFrozenQuoteDocument(result.payload, {
      quoteRevisionId: quoteRevision.id,
      quoteRevisionVersion: quoteRevision.version,
      costSnapshotId: calculatedCostSnapshot.id,
      costSnapshotHash: calculatedCostSnapshot.snapshot_hash,
      grandTotalMinor: calculatedCostSnapshot.grand_total_minor,
      currency: calculatedCostSnapshot.currency
    }, "quote document metadata get");

    const metadataArtifact = await requestText(baseUrl, `/api/supabase/documents/${generatedDocument.id}/preview`, {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "quote document artifact preview");
    requireSafe(metadataArtifact.response.ok, "Quote document artifact preview must succeed.");
    assertFrozenQuoteDocumentArtifact(metadataArtifact.text, {
      costSnapshotHash: calculatedCostSnapshot.snapshot_hash,
      grandTotalMinor: calculatedCostSnapshot.grand_total_minor,
      currency: calculatedCostSnapshot.currency
    }, "quote document artifact preview");

    result = await requestJson(baseUrl, "/api/supabase/demo-data", {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "audit after quote document");
    requireSafe(result.response.ok, "Demo data must succeed after quote document generation.");
    const auditAfterQuoteDocument = countAuditActions(result.payload.audit_entries);
    requireAuditDelta(auditBeforeQuoteDocument, auditAfterQuoteDocument, "quote_document_generated", 1);

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/artifacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": `draft-artifact-${suffix}` },
      body: JSON.stringify({})
    }, "draft revision quote artifact generation");
    requireSafe(result.response.status === 409, "Draft revision artifact generation must return 409.");

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/fork`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: viewerCookie, "x-idempotency-key": `viewer-fork-${suffix}` },
      body: JSON.stringify({ expected_revision_version: quoteRevision.version })
    }, "viewer quote fork");
    requireSafe(result.response.status === 403, "Viewer quote fork must return 403.");

    result = await requestJson(baseUrl, "/api/supabase/demo-data", {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "audit before quote fork");
    requireSafe(result.response.ok, "Demo data must succeed before quote fork.");
    const auditBeforeQuoteFork = countAuditActions(result.payload.audit_entries);

    const forkKey = `quote-fork-${suffix}`;
    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/fork`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": forkKey },
      body: JSON.stringify({ expected_revision_version: quoteRevision.version })
    }, "quote revision fork");
    requireSafe(result.response.status === 201, "Quote revision fork must return 201.");
    assertQuoteFork(result.payload, {
      sourceRevisionId: quoteRevision.id,
      projectId: project.id
    }, "quote revision fork");
    const forkedQuoteRevision = result.payload.quote_revision;

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/fork`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": forkKey },
      body: JSON.stringify({ expected_revision_version: quoteRevision.version })
    }, "quote revision fork replay");
    requireSafe(result.response.status === 201, "Quote revision fork replay must return the stored status.");
    requireSafe(result.payload.quote_revision?.id === forkedQuoteRevision.id, "Quote revision fork replay must return original fork id.");

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/fork`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": forkKey },
      body: JSON.stringify({ expected_revision_version: quoteRevision.version, idempotency_key: `conflicting-fork-${suffix}` })
    }, "quote revision fork conflict");
    requireSafe(result.response.status === 409, "Quote revision fork idempotency conflict must return 409.");

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/diff?against=${forkedQuoteRevision.id}`, {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "quote revision diff");
    requireSafe(result.response.ok, "Quote revision diff must succeed.");
    assertRevisionDiff(result.payload, {
      leftRevisionId: quoteRevision.id,
      rightRevisionId: forkedQuoteRevision.id
    }, "quote revision diff");

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/diff?against=${forkedQuoteRevision.id}&diff_entries=browser`, {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "quote revision diff forged query");
    requireSafe(result.response.status === 422, "Quote revision diff must reject forged query fields.");

    result = await requestJson(baseUrl, "/api/supabase/demo-data", {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "audit after quote fork");
    requireSafe(result.response.ok, "Demo data must succeed after quote fork.");
    const auditAfterQuoteFork = countAuditActions(result.payload.audit_entries);
    requireAuditDelta(auditBeforeQuoteFork, auditAfterQuoteFork, "quote_revision_forked", 1);

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/approval-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: viewerCookie, "x-idempotency-key": `viewer-approval-${suffix}` },
      body: JSON.stringify({ document_id: generatedDocument.id })
    }, "viewer approval gate prepare");
    requireSafe(result.response.status === 403, "Viewer approval gate prepare must return 403.");

    const adminDocumentKey = `admin-document-${suffix}`;
    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${adminQuoteRevision.id}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie, "x-idempotency-key": adminDocumentKey },
      body: JSON.stringify({})
    }, "admin quote document before calculate");
    requireSafe([409, 422].includes(result.response.status), "Admin quote document without snapshot must not succeed.");

    const approvalKey = `quote-approval-gate-${suffix}`;
    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/approval-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie, "x-idempotency-key": approvalKey },
      body: JSON.stringify({ document_id: generatedDocument.id })
    }, "admin approval gate prepare");
    requireSafe(result.response.status === 201, "Admin approval gate prepare must return 201.");
    assertApprovalGate(result.payload, {
      quoteRevisionId: quoteRevision.id,
      quoteRevisionVersion: quoteRevision.version,
      documentId: generatedDocument.id,
      documentHash: generatedDocument.sha256,
      costSnapshotHash: calculatedCostSnapshot.snapshot_hash
    }, "admin approval gate prepare");
    const preparedApprovalGate = result.payload.approval_gate;

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/approval-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie, "x-idempotency-key": approvalKey },
      body: JSON.stringify({ document_id: generatedDocument.id })
    }, "admin approval gate replay");
    requireSafe(result.response.status === 201, "Admin approval gate replay must return stored status.");
    requireSafe(result.payload.approval_gate?.id, "Admin approval gate replay must include approval id.");

    const salesApproval = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/approval-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": `sales-approval-denied-${suffix}` },
      body: JSON.stringify({ document_id: generatedDocument.id })
    }, "sales approval gate prepare");
    requireSafe(salesApproval.response.status === 403, "Sales approval gate prepare must be admin-only in P7.");

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/approval-status`, {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "approval gate status after denied attempts");
    requireSafe(result.response.ok, "Approval gate status must remain readable.");
    requireSafe(result.payload.approval_gate?.status === "pending", "Approval gate status must be pending after admin preparation.");
    requireSafe(result.payload.approval_gate?.token_secret_returned === false, "Approval gate status must never return the token secret.");

    result = await requestJson(baseUrl, "/api/supabase/demo-data", {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "audit after approval gate");
    requireSafe(result.response.ok, "Demo data must succeed after approval gate preparation.");
    const auditAfterApprovalGate = countAuditActions(result.payload.audit_entries);
    const auditAfterApprovalGateAll = countAllAuditActions(result.payload.audit_entries);
    requireAuditDelta(auditAfterQuoteFork, auditAfterApprovalGate, "quote_approval_gate_prepared", 1);

    const approvalSetupEnv = serviceRoleEnv();
    const staleVersionApprovalToken = newApprovalSmokeToken();
    await patchApprovalTokenHashForSmoke(
      approvalSetupEnv,
      preparedApprovalGate.id,
      approvalSmokeTokenHash(staleVersionApprovalToken),
      { quote_revision_version: 0 }
    );
    result = await requestJson(baseUrl, "/api/supabase/approval-tokens/consume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approval_token: staleVersionApprovalToken })
    }, "stale revision approval token consume");
    requireSafe(result.response.status === 404, "Stale revision approval token must return 404.");
    assertApprovalConsumption(result.payload, "invalid", "stale revision approval token consume");

    const wrongDocumentHashToken = newApprovalSmokeToken();
    await patchApprovalTokenHashForSmoke(
      approvalSetupEnv,
      preparedApprovalGate.id,
      approvalSmokeTokenHash(wrongDocumentHashToken),
      { document_hash: "0".repeat(64) }
    );
    result = await requestJson(baseUrl, "/api/supabase/approval-tokens/consume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approval_token: wrongDocumentHashToken })
    }, "wrong document hash approval token consume");
    requireSafe(result.response.status === 404, "Wrong document hash approval token must return 404.");
    assertApprovalConsumption(result.payload, "invalid", "wrong document hash approval token consume");

    const approvalToken = newApprovalSmokeToken();
    await patchApprovalTokenHashForSmoke(
      approvalSetupEnv,
      preparedApprovalGate.id,
      approvalSmokeTokenHash(approvalToken),
      {
        quote_revision_version: quoteRevision.version,
        cost_snapshot_id: calculatedCostSnapshot.id,
        generated_document_id: generatedDocument.id,
        snapshot_hash: calculatedCostSnapshot.snapshot_hash,
        document_hash: generatedDocument.sha256
      }
    );
    result = await requestJson(baseUrl, "/api/supabase/approval-tokens/consume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        approval_token: approvalToken,
        status: "approved",
        quote_revision_id: quoteRevision.id,
        document_hash: "browser-supplied",
        snapshot_hash: "browser-supplied",
        token_hash: "browser-supplied"
      })
    }, "forged approval token consume body");
    requireSafe(result.response.status === 422, "Forged approval token consumption body must return 422.");
    assertApprovalConsumption(result.payload, "invalid", "forged approval token consume body");

    result = await requestJson(baseUrl, "/api/supabase/approval-tokens/consume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approval_token: approvalToken })
    }, "approval token consume");
    requireSafe(result.response.status === 200, "Approval token consumption must return 200.");
    assertApprovalConsumption(result.payload, "approved", "approval token consume", { quoteStatusChanged: true });
    requireSafe(result.payload.approval_consumption?.consumed === true, "Approval token consumption must mark consumed true.");

    result = await requestJson(baseUrl, "/api/supabase/approval-tokens/consume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approval_token: approvalToken })
    }, "approval token replay");
    requireSafe(result.response.status === 409, "Consumed approval token replay must return 409.");
    assertApprovalConsumption(result.payload, "replayed", "approval token replay");
    requireSafe(result.payload.approval_consumption?.consumed === false, "Approval token replay must not consume again.");

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/approval-status`, {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "approval gate status after consumption");
    requireSafe(result.response.ok, "Approval gate status must be readable after consumption.");
    requireSafe(result.payload.approval_gate?.status === "approved", "Approval gate status must become approved.");
    requireSafe(result.payload.approval_gate?.token_secret_returned === false, "Consumed approval gate status must not return token secret.");
    requireSafe(result.payload.approval_gate?.quote_status_changed === true, "Approval consumption must change quote status after P9 finalization.");

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}`, {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "quote revision after approval finalization");
    requireSafe(result.response.ok, "Quote revision must be readable after approval finalization.");
    requireSafe(result.payload.quote_revision?.status === "approved", "Quote revision must be approved after valid token consumption.");
    requireSafe(result.payload.status_policy?.mutable === false, "Approved quote revision must be immutable.");
    const approvedQuoteRevision = result.payload.quote_revision;

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/send-gate`, {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "send gate after approval finalization");
    requireSafe(result.response.ok, "Send gate status must be readable after approval finalization.");
    assertSendGate(result.payload, {
      quoteRevisionId: quoteRevision.id,
      quoteStatus: "approved",
      approved: true,
      eligibleToPrepare: false,
      artifactBound: false,
      artifactStatus: "html_storage_missing"
    }, "send gate after approval finalization");

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/send-intents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": `send-intent-before-artifact-${suffix}` },
      body: JSON.stringify({})
    }, "send intent before artifact");
    requireSafe(result.response.status === 409, "Send intent before stored artifact must return 409.");

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/artifacts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: salesCookie,
        "x-idempotency-key": `artifact-cross-site-${suffix}`,
        Origin: "https://cross-site.invalid",
        "Sec-Fetch-Site": "cross-site"
      },
      body: JSON.stringify({})
    }, "cross-site artifact generation");
    requireSafe(result.response.status === 403, "Cross-site artifact generation must return 403.");

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/artifacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: viewerCookie, "x-idempotency-key": `viewer-artifact-${suffix}` },
      body: JSON.stringify({})
    }, "viewer artifact generation");
    requireSafe(result.response.status === 403, "Viewer artifact generation must return 403.");

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/artifacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": `forged-artifact-${suffix}` },
      body: JSON.stringify({
        ...forgedPayloadMarkers,
        sha256: "0".repeat(64),
        source_document_hash: "1".repeat(64),
        size_bytes: 1,
        content_type: "application/pdf",
        status: "stored",
        pdf_status: "generated"
      })
    }, "forged quote artifact generation body");
    requireSafe(result.response.status === 422, "Forged artifact generation body must return 422.");

    result = await requestJson(baseUrl, "/api/supabase/demo-data", {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "audit before artifact storage");
    requireSafe(result.response.ok, "Demo data must succeed before artifact storage.");
    const auditBeforeArtifact = countAuditActions(result.payload.audit_entries);

    const artifactKey = `quote-artifact-${suffix}`;
    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/artifacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": artifactKey },
      body: JSON.stringify({})
    }, "quote artifact storage");
    requireSafe(result.response.status === 201, "Quote artifact storage must return 201.");
    assertStoredQuoteArtifact(result.payload, {
      quoteRevisionId: quoteRevision.id,
      quoteRevisionVersion: approvedQuoteRevision.version,
      documentId: generatedDocument.id,
      documentHash: generatedDocument.sha256,
      documentSizeBytes: generatedDocument.size_bytes,
      costSnapshotId: calculatedCostSnapshot.id,
      costSnapshotHash: calculatedCostSnapshot.snapshot_hash
    }, "quote artifact storage");
    const storedArtifact = result.payload.artifact;

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/artifacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": artifactKey },
      body: JSON.stringify({})
    }, "quote artifact idempotency replay");
    requireSafe(result.response.status === 201, "Quote artifact replay must return stored status.");
    requireSafe(result.payload.artifact?.id === storedArtifact.id, "Quote artifact replay must return the original artifact id.");

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/artifacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": artifactKey },
      body: JSON.stringify({ idempotency_key: `conflicting-artifact-${suffix}` })
    }, "quote artifact idempotency conflict");
    requireSafe(result.response.status === 409, "Quote artifact idempotency conflict must return 409.");

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/artifacts`, {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "quote artifact list");
    requireSafe(result.response.ok, "Quote artifact list must succeed.");
    requireSafe(
      result.payload.artifacts?.some((artifact) => artifact.id === storedArtifact.id),
      "Quote artifact list must include the stored artifact."
    );
    assertNoForbiddenResponseFields("quote artifact list", result.payload);

    result = await requestJson(baseUrl, `/api/supabase/artifacts/${storedArtifact.id}`, {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "quote artifact metadata get");
    requireSafe(result.response.ok, "Quote artifact metadata get must succeed.");
    assertStoredQuoteArtifact(result.payload, {
      quoteRevisionId: quoteRevision.id,
      quoteRevisionVersion: approvedQuoteRevision.version,
      documentId: generatedDocument.id,
      documentHash: generatedDocument.sha256,
      documentSizeBytes: generatedDocument.size_bytes,
      costSnapshotId: calculatedCostSnapshot.id,
      costSnapshotHash: calculatedCostSnapshot.snapshot_hash
    }, "quote artifact metadata get");

    const downloadedArtifact = await requestText(baseUrl, `/api/supabase/artifacts/${storedArtifact.id}/download`, {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "quote artifact controlled download");
    requireSafe(downloadedArtifact.response.ok, "Quote artifact controlled download must succeed.");
    requireSafe(
      (downloadedArtifact.response.headers.get("content-disposition") || "").includes("attachment"),
      "Quote artifact download must be attachment-scoped."
    );
    requireSafe(
      (downloadedArtifact.response.headers.get("cache-control") || "").includes("no-store"),
      "Quote artifact download must be no-store."
    );
    requireSafe(
      (downloadedArtifact.response.headers.get("x-content-type-options") || "").toLowerCase() === "nosniff",
      "Quote artifact download must set nosniff."
    );
    requireSafe(
      createHash("sha256").update(downloadedArtifact.text, "utf8").digest("hex") === storedArtifact.sha256,
      "Downloaded artifact hash must match stored artifact hash."
    );
    assertFrozenQuoteDocumentArtifact(downloadedArtifact.text, {
      costSnapshotHash: calculatedCostSnapshot.snapshot_hash,
      grandTotalMinor: calculatedCostSnapshot.grand_total_minor,
      currency: calculatedCostSnapshot.currency
    }, "quote artifact controlled download");

    result = await requestJson(baseUrl, `/api/supabase/artifacts/${storedArtifact.id}`, {
      method: "GET",
      headers: { Cookie: secondTenantCookie }
    }, "second tenant reads stored artifact metadata");
    requireSafe(result.response.status === 404, "Second tenant artifact metadata read must return tenant-scoped 404.");

    const secondTenantDownload = await requestText(baseUrl, `/api/supabase/artifacts/${storedArtifact.id}/download`, {
      method: "GET",
      headers: { Cookie: secondTenantCookie }
    }, "second tenant downloads stored artifact");
    requireSafe(secondTenantDownload.response.status === 404, "Second tenant artifact download must return tenant-scoped 404.");

    result = await requestJson(baseUrl, "/api/supabase/demo-data", {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "audit after artifact storage");
    requireSafe(result.response.ok, "Demo data must succeed after artifact storage.");
    const auditAfterArtifact = countAuditActions(result.payload.audit_entries);
    requireAuditDelta(auditBeforeArtifact, auditAfterArtifact, "quote_artifact_stored", 1);

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/send-gate`, {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "send gate after artifact storage");
    requireSafe(result.response.ok, "Send gate after artifact storage must be readable.");
    assertSendGate(result.payload, {
      quoteRevisionId: quoteRevision.id,
      quoteStatus: "approved",
      approved: true,
      eligibleToPrepare: true,
      artifactBound: true,
      artifactStatus: "html_stored_pdf_deferred"
    }, "send gate after artifact storage");

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/send-intents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: salesCookie,
        "x-idempotency-key": `send-intent-cross-site-${suffix}`,
        Origin: "https://cross-site.invalid",
        "Sec-Fetch-Site": "cross-site"
      },
      body: JSON.stringify({})
    }, "cross-site send-intent preparation");
    requireSafe(result.response.status === 403, "Cross-site send-intent preparation must return 403.");

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/send-intents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: viewerCookie, "x-idempotency-key": `viewer-send-intent-${suffix}` },
      body: JSON.stringify({})
    }, "viewer send-intent preparation");
    requireSafe(result.response.status === 403, "Viewer send-intent preparation must return 403.");

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/send-intents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": `forged-send-intent-${suffix}` },
      body: JSON.stringify({
        ...forgedPayloadMarkers,
        status: "sent",
        quote_sent: true,
        external_delivery_attempted: true,
        email_provider_configured: true,
        recipient_source: "browser",
        quote_artifact_id: fakeArtifactId
      })
    }, "forged send-intent body");
    requireSafe(result.response.status === 422, "Forged send-intent body must return 422.");

    result = await requestJson(baseUrl, "/api/supabase/demo-data", {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "audit before send-intent preparation");
    requireSafe(result.response.ok, "Demo data must succeed before send-intent preparation.");
    const auditBeforeSendIntent = countAuditActions(result.payload.audit_entries);

    const sendIntentKey = `quote-send-intent-${suffix}`;
    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/send-intents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": sendIntentKey },
      body: JSON.stringify({})
    }, "quote send-intent preparation");
    requireSafe(result.response.status === 201, "Quote send-intent preparation must return 201.");
    assertSendIntent(result.payload, {
      quoteRevisionId: quoteRevision.id,
      artifactId: storedArtifact.id,
      documentId: generatedDocument.id
    }, "quote send-intent preparation");
    const sendIntent = result.payload.send_intent;

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/send-intents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": sendIntentKey },
      body: JSON.stringify({})
    }, "quote send-intent idempotency replay");
    requireSafe(result.response.status === 201, "Quote send-intent replay must return stored status.");
    requireSafe(result.payload.send_intent?.id === sendIntent.id, "Quote send-intent replay must return the original intent id.");

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/send-intents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": sendIntentKey },
      body: JSON.stringify({ idempotency_key: `conflicting-send-intent-${suffix}` })
    }, "quote send-intent idempotency conflict");
    requireSafe(result.response.status === 409, "Quote send-intent idempotency conflict must return 409.");

    result = await requestJson(baseUrl, "/api/supabase/demo-data", {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "audit after send-intent preparation");
    requireSafe(result.response.ok, "Demo data must succeed after send-intent preparation.");
    const auditAfterSendIntent = countAuditActions(result.payload.audit_entries);
    requireAuditDelta(auditBeforeSendIntent, auditAfterSendIntent, "quote_send_intent_prepared", 1);

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/send-gate`, {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "send gate after send-intent preparation");
    requireSafe(result.response.ok, "Send gate after send-intent preparation must be readable.");
    requireSafe(
      result.payload.send_gate?.latest_send_intent_status === sendIntent.status,
      "Send gate must report the latest send-intent status."
    );
    assertSendGate(result.payload, {
      quoteRevisionId: quoteRevision.id,
      quoteStatus: "approved",
      approved: true,
      eligibleToPrepare: true,
      artifactBound: true,
      artifactStatus: "html_stored_pdf_deferred"
    }, "send gate after send-intent preparation");

    const sendGatePost = await requestText(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/send-gate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": `send-gate-post-${suffix}` },
      body: JSON.stringify({ ...forgedPayloadMarkers, send_state: "browser-supplied" })
    }, "send gate post probe");
    requireSafe([404, 405].includes(sendGatePost.response.status), "Send gate POST must remain unavailable.");

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/configuration-draft`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": `approved-final-config-update-${suffix}` },
      body: JSON.stringify(configurationDraftBody({
        expected_version: configurationDraft.version,
        width_mm: 1900
      }))
    }, "approved finalized revision configuration update");
    requireSafe(result.response.status === 409, "Approved finalized revision configuration update must return 409.");

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/calculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": `approved-final-calculate-${suffix}` },
      body: JSON.stringify({ expected_configuration_version: configurationDraft.version })
    }, "approved finalized revision calculate");
    requireSafe(result.response.status === 409, "Approved finalized revision calculate must return 409.");

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": `approved-final-document-${suffix}` },
      body: JSON.stringify({})
    }, "approved finalized revision document generation");
    requireSafe(result.response.status === 409, "Approved finalized revision document generation must return 409.");

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/approval-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie, "x-idempotency-key": `approved-final-approval-gate-${suffix}` },
      body: JSON.stringify({ document_id: generatedDocument.id })
    }, "approved finalized revision approval gate prepare");
    requireSafe(result.response.status === 409, "Approved finalized revision approval gate preparation must return 409.");

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/fork`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": `approved-final-fork-${suffix}` },
      body: JSON.stringify({ expected_revision_version: approvedQuoteRevision.version })
    }, "approved finalized revision fork");
    requireSafe(result.response.status === 201, "Approved finalized revision fork must return 201.");
    assertQuoteFork(result.payload, {
      sourceRevisionId: quoteRevision.id,
      projectId: project.id
    }, "approved finalized revision fork");

    result = await requestJson(baseUrl, "/api/supabase/demo-data", {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "audit after approval token consumption");
    requireSafe(result.response.ok, "Demo data must succeed after approval token consumption.");
    const auditAfterApprovalConsume = countAuditActions(result.payload.audit_entries);
    const auditAfterApprovalConsumeAll = countAllAuditActions(result.payload.audit_entries);
    requireAuditIncrease(auditAfterApprovalGate, auditAfterApprovalConsume, "quote_approved");
    requireAuditActionIncrease(auditAfterApprovalGateAll, auditAfterApprovalConsumeAll, "quote_approval_token_replayed");

    const expiredApprovalToken = newApprovalSmokeToken();
    await patchApprovalTokenHashForSmoke(
      approvalSetupEnv,
      preparedApprovalGate.id,
      approvalSmokeTokenHash(expiredApprovalToken),
      {
        quote_revision_version: quoteRevision.version,
        cost_snapshot_id: calculatedCostSnapshot.id,
        generated_document_id: generatedDocument.id,
        snapshot_hash: calculatedCostSnapshot.snapshot_hash,
        document_hash: generatedDocument.sha256,
        expires_at: new Date(Date.now() - 60_000).toISOString()
      }
    );
    result = await requestJson(baseUrl, "/api/supabase/approval-tokens/consume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approval_token: expiredApprovalToken })
    }, "expired approval token consume");
    requireSafe(result.response.status === 409, "Expired approval token consumption must return 409.");
    assertApprovalConsumption(result.payload, "expired", "expired approval token consume");
    requireSafe(result.payload.approval_consumption?.consumed === false, "Expired approval token must not consume.");

    result = await requestJson(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}/approval-status`, {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "approval gate status after expired consumption");
    requireSafe(result.response.ok, "Approval gate status must be readable after expired consumption.");
    requireSafe(result.payload.approval_gate?.status === "expired", "Approval gate status must become expired.");
    requireSafe(result.payload.approval_gate?.quote_status_changed === false, "Expired approval consumption must not change quote status.");

    result = await requestJson(baseUrl, "/api/supabase/demo-data", {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "audit after expired approval token");
    requireSafe(result.response.ok, "Demo data must succeed after expired approval token.");
    requireAuditActionIncrease(auditAfterApprovalConsumeAll, countAllAuditActions(result.payload.audit_entries), "quote_approval_token_expired");

    result = await requestJson(baseUrl, `/api/supabase/projects/${project.id}`, {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "project detail after quote");
    requireSafe(result.response.ok, "Project detail must succeed after quote draft.");
    requireSafe(
      result.payload.quote_revisions.some((item) => item.id === quoteRevision.id),
      "Project detail timeline must include the created quote draft."
    );

    const riskyRouteProbes = [
      `/api/supabase/quote-revisions/${quoteRevision.id}/send`,
      `/api/supabase/quote-revisions/${quoteRevision.id}/approve`,
      `/api/supabase/quote-revisions/${quoteRevision.id}/pdf`,
      `/api/supabase/quote-revisions/${quoteRevision.id}/production-package`
    ];
    for (const path of riskyRouteProbes) {
      for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
        const risky = await requestText(baseUrl, path, {
          method,
          headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": `risky-${method}-${suffix}` },
          body: method === "GET" ? undefined : JSON.stringify(forgedPayloadMarkers)
        }, `risky route probe ${method} ${path}`);
        requireSafe([404, 405].includes(risky.response.status), `Risky route ${method} ${path} must remain unavailable.`);
      }
    }

    const statusEscalation = await requestText(baseUrl, `/api/supabase/quote-revisions/${quoteRevision.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": `status-escalation-${suffix}` },
      body: JSON.stringify({ ...forgedPayloadMarkers, status: "approved" })
    }, "quote status escalation patch");
    requireSafe([404, 405].includes(statusEscalation.response.status), "Direct quote status escalation must remain unavailable.");

    result = await requestJson(baseUrl, "/api/supabase/demo-data", {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "audit verification");
    requireSafe(result.response.ok, "Demo data must succeed after mutation login.");
    const auditActions = new Set((result.payload.audit_entries || []).map((entry) => entry.action));
    requireSafe(auditActions.has("customer_created"), "Audit entries must include customer_created.");
    requireSafe(auditActions.has("project_created"), "Audit entries must include project_created.");
    requireSafe(auditActions.has("quote_draft_created"), "Audit entries must include quote_draft_created.");
    requireSafe(auditActions.has("quote_configuration_created"), "Audit entries must include quote_configuration_created.");
    requireSafe(auditActions.has("quote_configuration_updated"), "Audit entries must include quote_configuration_updated.");
    requireSafe(auditActions.has("quote_snapshot_calculated"), "Audit entries must include quote_snapshot_calculated.");
    requireSafe(auditActions.has("quote_document_generated"), "Audit entries must include quote_document_generated.");
    requireSafe(auditActions.has("quote_revision_forked"), "Audit entries must include quote_revision_forked.");
    requireSafe(auditActions.has("quote_approval_gate_prepared"), "Audit entries must include quote_approval_gate_prepared.");
    requireSafe(auditActions.has("quote_approved"), "Audit entries must include quote_approved.");
    requireSafe(auditActions.has("quote_artifact_stored"), "Audit entries must include quote_artifact_stored.");
    requireSafe(auditActions.has("quote_send_intent_prepared"), "Audit entries must include quote_send_intent_prepared.");
    requireSafe(auditActions.has("quote_approval_token_replayed"), "Audit entries must include quote_approval_token_replayed.");
    requireSafe(auditActions.has("quote_approval_token_expired"), "Audit entries must include quote_approval_token_expired.");
    const auditAfter = countAuditActions(result.payload.audit_entries);
    const auditAfterAll = countAllAuditActions(result.payload.audit_entries);
    requireAuditIncrease(auditBefore, auditAfter, "customer_created");
    requireAuditIncrease(auditBefore, auditAfter, "project_created");
    requireAuditIncrease(auditBefore, auditAfter, "quote_draft_created");
    requireAuditIncrease(auditBefore, auditAfter, "quote_configuration_created");
    requireAuditIncrease(auditBefore, auditAfter, "quote_configuration_updated");
    requireAuditIncrease(auditBefore, auditAfter, "quote_snapshot_calculated");
    requireAuditIncrease(auditBefore, auditAfter, "quote_document_generated");
    requireAuditIncrease(auditBefore, auditAfter, "quote_revision_forked");
    requireAuditIncrease(auditBefore, auditAfter, "quote_approval_gate_prepared");
    requireAuditIncrease(auditBefore, auditAfter, "quote_approved");
    requireAuditIncrease(auditBefore, auditAfter, "quote_artifact_stored");
    requireAuditIncrease(auditBefore, auditAfter, "quote_send_intent_prepared");
    requireAuditActionIncrease(auditBeforeAll, auditAfterAll, "quote_approval_token_replayed");
    requireAuditActionIncrease(auditBeforeAll, auditAfterAll, "quote_approval_token_expired");

    console.log("web mutation route smoke passed");
  } finally {
    await stopNextServer(child);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
