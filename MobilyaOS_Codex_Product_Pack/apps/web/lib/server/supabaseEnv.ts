export type SupabaseServerEnv = {
  supabaseUrl: string;
  supabaseSecretKey: string;
  supabasePublishableKey: string;
};

import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";

const requiredServerKeys = [
  "SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
] as const;

function repositoryRoot(start = process.cwd()): string {
  let cursor = start;
  for (;;) {
    if (existsSync(join(cursor, "README.md")) && existsSync(join(cursor, "package.json"))) {
      return cursor;
    }
    const parent = dirname(cursor);
    if (parent === cursor) {
      return process.cwd();
    }
    cursor = parent;
  }
}

function parseEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) {
    return {};
  }
  const values: Record<string, string> = {};
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

function loadRootEnv(): Record<string, string> {
  const root = repositoryRoot();
  return {
    ...parseEnvFile(join(root, ".env")),
    ...parseEnvFile(join(root, ".env.local"))
  };
}

function lookupEnv(key: string): string {
  const fileEnv = loadRootEnv();
  return process.env[key] || fileEnv[key] || "";
}

export function loadSupabaseServerEnv(): SupabaseServerEnv {
  const missing = requiredServerKeys.filter((key) => !lookupEnv(key));
  if (missing.length) {
    throw new Error(`Supabase server env is incomplete: ${missing.length} value(s) missing.`);
  }
  return {
    supabaseUrl: lookupEnv("SUPABASE_URL"),
    supabaseSecretKey: lookupEnv("SUPABASE_SECRET_KEY"),
    supabasePublishableKey: lookupEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
  };
}

export function loadSessionKeyMaterial(): string {
  const keyMaterial = lookupEnv("SESSION_ENCRYPTION_KEY") || lookupEnv("JWT_SECRET");
  if (!keyMaterial) {
    throw new Error("Session server env is incomplete: 1 value missing.");
  }
  return keyMaterial;
}
