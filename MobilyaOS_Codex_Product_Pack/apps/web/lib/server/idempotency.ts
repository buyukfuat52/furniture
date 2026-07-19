import { createHash } from "node:crypto";
import { loadSupabaseServerEnv } from "./supabaseEnv";

type JsonRecord = Record<string, unknown>;

type IdempotencyRecordRow = {
  id: string;
  request_hash: string;
  state: "in_progress" | "completed";
  status_code: number | null;
  response_json: unknown;
  inserted: boolean;
};

export type IdempotencyReplay = {
  replayed: true;
  status: number;
  body: unknown;
};

export type IdempotencyReservation = {
  id: string;
  requestHash: string;
  companyId: string;
  appUserId: string;
  action: string;
  mode: "durable_supabase_scoped";
};

const ttlMs = 10 * 60 * 1000;
const forbiddenStoredKeys = new Set([
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "DIRECT_DATABASE_URL",
  "JWT_SECRET",
  "SESSION_ENCRYPTION_KEY",
  "auth_user_id",
  "actor_app_user_id",
  "access_token",
  "approval_token",
  "acknowledgement_hash",
  "artifact_html",
  "delivery_status",
  "delivery_verified",
  "provider_acknowledged",
  "provider_acknowledgement",
  "provider_raw_payload",
  "raw_provider_payload",
  "raw_provider_payload_stored",
  "sent_at",
  "sandbox_ack_secret",
  "sandbox_raw_payload",
  "webhook_secret",
  "api_key",
  "refresh_token",
  "provider_message_id",
  "provider_response",
  "provider_secret",
  "recipient_email",
  "service_role",
  "smtp_password",
  "storage_path",
  "raw_storage_path",
  "html",
  "database_password"
]);

function normalizeKey(value: string): string {
  return value.trim().slice(0, 160);
}

function hashText(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }
  const objectValue = value as JsonRecord;
  const entries = Object.keys(objectValue)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(objectValue[key])}`);
  return `{${entries.join(",")}}`;
}

function hashInput(value: unknown): string {
  return hashText(stableJson(value));
}

function expiresAt(): string {
  return new Date(Date.now() + ttlMs).toISOString();
}

function sanitizeStoredValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeStoredValue(item));
  }
  if (value && typeof value === "object") {
    const output: JsonRecord = {};
    for (const [key, child] of Object.entries(value as JsonRecord)) {
      if (forbiddenStoredKeys.has(key)) {
        continue;
      }
      output[key] = sanitizeStoredValue(child);
    }
    return output;
  }
  return value;
}

async function supabaseRest<T>(path: string, init?: RequestInit): Promise<T> {
  const env = loadSupabaseServerEnv();
  const response = await fetch(`${env.supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: env.supabaseSecretKey,
      Authorization: `Bearer ${env.supabaseSecretKey}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`Idempotency repository request failed with status ${response.status}.`);
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

export function idempotencyKeyFromRequest(request: Request, body: Record<string, unknown>): string | null {
  const header = request.headers.get("x-idempotency-key") ?? request.headers.get("idempotency-key") ?? "";
  const bodyValue = typeof body.idempotency_key === "string" ? body.idempotency_key : "";
  const key = normalizeKey(header || bodyValue);
  return key || null;
}

export async function reserveIdempotency(input: {
  key: string | null;
  companyId: string;
  appUserId: string;
  action: string;
  body: unknown;
}): Promise<IdempotencyReplay | IdempotencyReservation | null> {
  if (!input.key) {
    return null;
  }

  const requestHash = hashInput(input.body);
  const rows = await supabaseRest<IdempotencyRecordRow[]>(
    "rpc/reserve_idempotency_record",
    {
      method: "POST",
      body: JSON.stringify({
        p_company_id: input.companyId,
        p_actor_app_user_id: input.appUserId,
        p_action: input.action,
        p_idempotency_key_hash: hashText(input.key),
        p_request_hash: requestHash,
        p_expires_at: expiresAt()
      })
    }
  );
  const row = rows[0];
  if (!row) {
    throw new Error("Idempotency reservation was not returned.");
  }
  if (row.request_hash !== requestHash) {
    return {
      replayed: true,
      status: 409,
      body: {
        title: "Idempotency conflict",
        detail: "The same idempotency key was used with a different request body."
      }
    };
  }
  if (row.inserted) {
    return {
      id: row.id,
      requestHash,
      companyId: input.companyId,
      appUserId: input.appUserId,
      action: input.action,
      mode: "durable_supabase_scoped"
    };
  }
  if (row.state === "completed" && typeof row.status_code === "number") {
    return {
      replayed: true,
      status: row.status_code,
      body: sanitizeStoredValue(row.response_json ?? {})
    };
  }
  return {
    replayed: true,
    status: 409,
    body: {
      title: "Request already in progress",
      detail: "The same idempotency key is already reserved for an unfinished request."
    }
  };
}

export async function storeIdempotencyResult(
  reservation: IdempotencyReservation | null,
  status: number,
  body: unknown
): Promise<void> {
  if (!reservation) {
    return;
  }
  const params = new URLSearchParams({
    id: `eq.${reservation.id}`,
    company_id: `eq.${reservation.companyId}`,
    actor_app_user_id: `eq.${reservation.appUserId}`,
    action: `eq.${reservation.action}`
  });
  await supabaseRest<null>(
    `idempotency_records?${params.toString()}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        state: "completed",
        status_code: status,
        response_json: sanitizeStoredValue(body),
        updated_at: new Date().toISOString()
      })
    }
  );
}
