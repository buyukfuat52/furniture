import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = dirname(scriptDir);
const repoRoot = findRepoRoot(appRoot);
const fakeCustomerId = "00000000-0000-4000-8000-000000000001";
const fakeProjectId = "00000000-0000-4000-8000-000000000002";
const fakeQuoteRevisionId = "00000000-0000-4000-8000-000000000003";
const demoCustomerId = "77777777-7777-4777-8777-777777777777";
const demoProjectId = "44444444-4444-4444-8444-444444444444";
const demoQuoteRevisionId = "14141414-1414-4141-8141-141414141414";
const demoApprovedQuoteRevisionId = "24242424-2424-4242-8242-242424242424";
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
  "storage_bucket",
  "storage_path",
  "raw_storage_path",
  "database_password"
];
const forbiddenResponseFields = [
  "company_id",
  "auth_user_id",
  "actor_app_user_id",
  "access_token",
  "refresh_token",
  "service_role",
  "storage_path",
  "raw_storage_path",
  "database_password"
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

function assertSafePayload(label, value) {
  const text = typeof value === "string" ? value : JSON.stringify(value) ?? "";
  const normalized = text.toLowerCase();
  for (const key of forbiddenPayloadKeys) {
    requireSafe(!normalized.includes(key.toLowerCase()), `${label} includes forbidden marker ${key}.`);
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

function requireAuditIncrease(before, after, action) {
  requireSafe(
    (after.get(action) ?? 0) > (before.get(action) ?? 0),
    `Audit entries must append an allowed ${action} row.`
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
      notes: "Updated smoke test wardrobe draft"
    });
    const expectedUpdatedConfig = { ...expectedConfig, width_mm: 1900 };
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
    const auditAfter = countAuditActions(result.payload.audit_entries);
    requireAuditIncrease(auditBefore, auditAfter, "customer_created");
    requireAuditIncrease(auditBefore, auditAfter, "project_created");
    requireAuditIncrease(auditBefore, auditAfter, "quote_draft_created");
    requireAuditIncrease(auditBefore, auditAfter, "quote_configuration_created");
    requireAuditIncrease(auditBefore, auditAfter, "quote_configuration_updated");

    console.log("web mutation route smoke passed");
  } finally {
    await stopNextServer(child);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
