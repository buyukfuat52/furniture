import { createHash } from "node:crypto";

type IdempotencyEntry = {
  fingerprint: string;
  status: number;
  body: unknown;
  expiresAt: number;
};

const ttlMs = 10 * 60 * 1000;
const cache = new Map<string, IdempotencyEntry>();

export type IdempotencyReplay = {
  replayed: boolean;
  status: number;
  body: unknown;
};

export type IdempotencyReservation = {
  cacheKey: string;
  fingerprint: string;
};

function normalizeKey(value: string): string {
  return value.trim().slice(0, 160);
}

function now(): number {
  return Date.now();
}

function pruneExpired(): void {
  const current = now();
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= current) {
      cache.delete(key);
    }
  }
}

function hashInput(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

export function idempotencyKeyFromRequest(request: Request, body: Record<string, unknown>): string | null {
  const header = request.headers.get("x-idempotency-key") ?? request.headers.get("idempotency-key") ?? "";
  const bodyValue = typeof body.idempotency_key === "string" ? body.idempotency_key : "";
  const key = normalizeKey(header || bodyValue);
  return key || null;
}

export function reserveIdempotency(input: {
  key: string | null;
  companyId: string;
  appUserId: string;
  action: string;
  body: unknown;
}): IdempotencyReplay | IdempotencyReservation | null {
  if (!input.key) {
    return null;
  }
  pruneExpired();
  const cacheKey = `${input.companyId}:${input.appUserId}:${input.action}:${input.key}`;
  const fingerprint = hashInput(input.body);
  const existing = cache.get(cacheKey);
  if (!existing) {
    return { cacheKey, fingerprint };
  }
  if (existing.fingerprint !== fingerprint) {
    return {
      replayed: true,
      status: 409,
      body: {
        title: "Idempotency conflict",
        detail: "The same idempotency key was used with a different request body."
      }
    };
  }
  return {
    replayed: true,
    status: existing.status,
    body: existing.body
  };
}

export function storeIdempotencyResult(
  reservation: IdempotencyReservation | null,
  status: number,
  body: unknown
): void {
  if (!reservation) {
    return;
  }
  cache.set(reservation.cacheKey, {
    fingerprint: reservation.fingerprint,
    status,
    body,
    expiresAt: now() + ttlMs
  });
}
