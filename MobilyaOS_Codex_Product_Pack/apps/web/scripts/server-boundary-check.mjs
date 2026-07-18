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
  "database_password"
];

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
  for (const key of forbidden) {
    if (text.includes(key)) {
      violations.push(`${relative(root, file)} references ${key}`);
    }
  }
}

const repositoryText = readFileSync(join(root, "lib/server/supabaseRepository.ts"), "utf8");
if (!repositoryText.includes("company_id") || !repositoryText.includes("assertCompanyScope")) {
  violations.push("server repository does not show tenant-scope enforcement markers");
}
if (!repositoryText.includes("auth_user_id")) {
  violations.push("server repository does not map Supabase Auth users to app_users");
}

const sessionText = readFileSync(join(root, "lib/server/session.ts"), "utf8");
if (!sessionText.includes("aes-256-gcm") || !sessionText.includes("httpOnly: true") || !sessionText.includes("expires_at")) {
  violations.push("server session boundary does not show encrypted HTTP-only expiring cookie markers");
}

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
if (
  !mutationBoundaryText.includes("TrustedMutationScope") ||
  !mutationBoundaryText.includes("quote_send") ||
  !mutationBoundaryText.includes("approval_required") ||
  !mutationBoundaryText.includes("allowed_mutation")
) {
  violations.push("server mutation boundary does not clearly prepare deferred/approval-gated product mutations");
}

const mutationRouteChecks = [
  ["app/api/supabase/customers/route.ts", ["withMutationSession", "create_customer", "appendAuditEntry", "customer_created"]],
  ["app/api/supabase/projects/route.ts", ["withMutationSession", "create_project", "appendAuditEntry", "project_created"]],
  ["app/api/supabase/projects/[projectId]/quote-drafts/route.ts", ["withMutationSession", "create_quote_revision_draft", "appendAuditEntry", "quote_draft_created", "deferred_actions"]],
  ["app/api/supabase/projects/[projectId]/quote-revisions/route.ts", ["withReadSession", "listQuoteRevisions"]],
  ["app/api/supabase/quote-revisions/[quoteRevisionId]/route.ts", ["withReadSession", "getQuoteRevision"]]
];
for (const [route, markers] of mutationRouteChecks) {
  const text = readFileSync(join(root, route), "utf8");
  for (const marker of markers) {
    if (!text.includes(marker)) {
      violations.push(`${route} is missing boundary marker ${marker}`);
    }
  }
}

if (violations.length) {
  console.error(violations.join("\n"));
  process.exit(1);
}

console.log("web server boundary check passed");
