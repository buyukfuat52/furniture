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
  "auth_user_id",
  "actor_app_user_id",
  "access_token",
  "refresh_token",
  "service_role",
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
  auth_user_id: "browser-supplied",
  access_token: "browser-supplied",
  refresh_token: "browser-supplied",
  service_role: "browser-supplied",
  storage_path: "browser-supplied",
  raw_storage_path: "browser-supplied",
  database_password: "browser-supplied",
  SUPABASE_SERVICE_ROLE_KEY: "browser-supplied",
  DATABASE_URL: "browser-supplied"
};
const deferredQuoteActions = ["quote_send", "quote_approve", "quote_pdf", "production_package"];
const unavailableQuotePayloadFields = [
  "approval_id",
  "approved_at",
  "document_url",
  "pdf_url",
  "production_job_id",
  "production_package_id",
  "sent_at",
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

async function readJson(response, label) {
  const text = await response.text();
  assertSafePayload(label, text);
  const payload = text ? JSON.parse(text) : {};
  assertNoForbiddenResponseFields(label, payload);
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

async function main() {
  requireSafe(existsSync(join(appRoot, ".next")), "Next build output is missing. Run npm run build -w apps/web first.");

  const password = process.env.DEMO_SEED_PASSWORD || "Demo1234!ChangeMe";
  requireSafe(Boolean(password), "Demo password is not configured.");

  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [nextCliPath(), "start", "-H", "127.0.0.1", "-p", String(port)], {
    cwd: appRoot,
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
    stdio: ["ignore", "ignore", "ignore"]
  });

  try {
    await waitForServer(baseUrl, child);

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
      }
    ];

    let result;
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

    const salesCookie = await login(baseUrl, "satis@demo.local", password);
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const customerKey = `customer-${suffix}`;
    const projectKey = `project-${suffix}`;
    const quoteDraftKey = `quote-draft-${suffix}`;

    result = await requestJson(baseUrl, "/api/supabase/demo-data", {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "audit baseline");
    requireSafe(result.response.ok, "Demo data must succeed before mutation audit baseline.");
    const auditBefore = countAuditActions(result.payload.audit_entries);

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

    result = await requestJson(baseUrl, "/api/supabase/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": `project-${suffix}` },
      body: JSON.stringify({ customer_id: customer.id, name: `Smoke Project ${suffix}`, company_id: "browser-supplied" })
    }, "project create");
    requireSafe(result.response.status === 201, "Sales project create must return 201.");
    const project = result.payload.project;
    requireSafe(Boolean(project?.id), "Project create payload must include a safe id.");
    requireSafe(project.status === "draft", "Project create payload must be draft.");
    requireSafe(!("company_id" in project), "Project payload must not expose company_id.");

    result = await requestJson(baseUrl, `/api/supabase/projects/${project.id}/quote-drafts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": `quote-draft-${suffix}` },
      body: JSON.stringify({ company_id: "browser-supplied", status: "sent" })
    }, "quote draft create");
    requireSafe(result.response.status === 201, "Sales quote draft create must return 201.");
    const quoteRevision = result.payload.quote_revision;
    requireSafe(Boolean(quoteRevision?.id), "Quote draft payload must include a safe id.");
    requireSafe(quoteRevision.status === "draft", "Quote draft status must remain draft.");
    requireSafe(Array.isArray(result.payload.deferred_actions), "Quote draft response must list deferred actions.");

    result = await requestJson(baseUrl, `/api/supabase/projects/${project.id}/quote-drafts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesCookie, "x-idempotency-key": `quote-draft-${suffix}` },
      body: JSON.stringify({ company_id: "browser-supplied", status: "sent" })
    }, "quote draft idempotency replay");
    requireSafe(result.response.status === 201, "Quote draft idempotency replay must return the stored status.");
    requireSafe(result.payload.quote_revision?.id === quoteRevision.id, "Quote draft idempotency replay must return the original result.");

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

    result = await requestJson(baseUrl, "/api/supabase/demo-data", {
      method: "GET",
      headers: { Cookie: salesCookie }
    }, "audit verification");
    requireSafe(result.response.ok, "Demo data must succeed after mutation login.");
    const auditActions = new Set((result.payload.audit_entries || []).map((entry) => entry.action));
    requireSafe(auditActions.has("customer_created"), "Audit entries must include customer_created.");
    requireSafe(auditActions.has("project_created"), "Audit entries must include project_created.");
    requireSafe(auditActions.has("quote_draft_created"), "Audit entries must include quote_draft_created.");

    console.log("web mutation route smoke passed");
  } finally {
    child.kill();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
