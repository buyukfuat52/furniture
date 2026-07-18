import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = dirname(scriptDir);
const repoRoot = findRepoRoot(appRoot);
const cookieName = "mobilyaos_demo_session";
const forbiddenPayloadKeys = [
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "DIRECT_DATABASE_URL",
  "auth_user_id",
  "access_token",
  "refresh_token",
  "service_role",
  "storage_path",
  "raw_storage_path",
  "database_password"
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

function requireSafe(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertSafePayload(label, value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  for (const key of forbiddenPayloadKeys) {
    requireSafe(!text.includes(key), `${label} includes forbidden key ${key}.`);
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
  return text ? JSON.parse(text) : {};
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

async function main() {
  requireSafe(existsSync(join(appRoot, ".next")), "Next build output is missing. Run npm run build -w apps/web first.");

  const localEnv = {
    ...parseEnvFile(join(repoRoot, ".env")),
    ...parseEnvFile(join(repoRoot, ".env.local")),
    ...process.env
  };
  const password = localEnv.DEMO_SEED_PASSWORD || "Demo1234!ChangeMe";
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

    let response = await fetch(`${baseUrl}/api/supabase/session`, { cache: "no-store" });
    requireSafe(response.status === 401, "Session endpoint must reject requests without a cookie.");
    assertSafePayload("session 401", await response.text());

    response = await fetch(`${baseUrl}/api/supabase/demo-data?company_id=browser-supplied`, { cache: "no-store" });
    requireSafe(response.status === 401, "Demo data endpoint must reject requests without a cookie.");
    assertSafePayload("demo-data 401", await response.text());

    response = await fetch(`${baseUrl}/api/supabase/demo-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "satis@demo.local", password: "invalid-demo-password" })
    });
    requireSafe(response.status === 401, "Invalid demo login must return 401.");
    assertSafePayload("invalid login", await response.text());

    response = await fetch(`${baseUrl}/api/supabase/demo-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "satis@demo.local", password })
    });
    requireSafe(response.ok, "Valid demo login must succeed.");
    const setCookie = response.headers.get("set-cookie") || "";
    requireSafe(setCookie.includes(cookieName), "Login must set the demo session cookie.");
    requireSafe(/httponly/i.test(setCookie), "Session cookie must be HttpOnly.");
    requireSafe(/samesite=lax/i.test(setCookie), "Session cookie must use SameSite=Lax.");
    requireSafe(/path=\//i.test(setCookie), "Session cookie must be scoped to the app path.");
    requireSafe(!/access_token|refresh_token|service_role/i.test(setCookie), "Session cookie must not expose token labels.");
    const loginPayload = await readJson(response, "valid login");
    requireSafe(loginPayload.authenticated === true, "Login payload must be authenticated.");
    requireSafe(loginPayload.session_persisted === true, "Login payload must report a persisted session.");
    requireSafe(Boolean(loginPayload.app_user?.role), "Login payload must include a sanitized role.");
    requireSafe(Boolean(loginPayload.company?.name), "Login payload must include a sanitized company.");

    const cookieHeader = firstCookie(setCookie);

    response = await fetch(`${baseUrl}/api/supabase/session`, {
      cache: "no-store",
      headers: { Cookie: cookieHeader }
    });
    requireSafe(response.ok, "Session endpoint must accept a valid session cookie.");
    const sessionPayload = await readJson(response, "session payload");
    requireSafe(sessionPayload.authenticated === true, "Session payload must be authenticated.");
    requireSafe(Boolean(sessionPayload.app_user?.role), "Session payload must include a sanitized role.");

    response = await fetch(`${baseUrl}/api/supabase/demo-data?company_id=browser-supplied`, {
      cache: "no-store",
      headers: { Cookie: cookieHeader }
    });
    requireSafe(response.ok, "Demo data endpoint must accept a valid session cookie.");
    const demoDataPayload = await readJson(response, "demo-data payload");
    requireSafe(demoDataPayload.source === "supabase", "Demo data must come from Supabase.");
    requireSafe(
      demoDataPayload.company?.name === sessionPayload.company?.name,
      "Demo data must use the session company scope."
    );

    response = await fetch(`${baseUrl}/api/supabase/logout`, {
      method: "POST",
      headers: { Cookie: cookieHeader }
    });
    requireSafe(response.ok, "Logout endpoint must succeed.");
    const logoutCookie = response.headers.get("set-cookie") || "";
    requireSafe(logoutCookie.includes(cookieName), "Logout must set the demo session cookie.");
    requireSafe(/max-age=0/i.test(logoutCookie), "Logout must clear the demo session cookie.");
    const logoutPayload = await readJson(response, "logout payload");
    requireSafe(logoutPayload.session_cleared === true, "Logout payload must report session_cleared.");

    response = await fetch(`${baseUrl}/api/supabase/session`, {
      cache: "no-store",
      headers: { Cookie: firstCookie(logoutCookie) }
    });
    requireSafe(response.status === 401, "Cleared session cookie must not authenticate.");
    assertSafePayload("cleared session", await response.text());

    console.log("web session route smoke passed");
  } finally {
    child.kill();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
