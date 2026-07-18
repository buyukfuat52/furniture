import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import type { ResolvedSession } from "./sessionContext";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitStore = Map<string, RateLimitEntry>;

const rateLimitStoreKey = "__mobilyaosDevRateLimitStore";
const mutationWindowMs = 60_000;
const loginWindowMs = 5 * 60_000;

function rateLimitStore(): RateLimitStore {
  const globalScope = globalThis as typeof globalThis & { __mobilyaosDevRateLimitStore?: RateLimitStore };
  if (!globalScope[rateLimitStoreKey]) {
    globalScope[rateLimitStoreKey] = new Map<string, RateLimitEntry>();
  }
  return globalScope[rateLimitStoreKey];
}

function hashBucket(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function sameOrigin(urlText: string, requestOrigin: string): boolean {
  try {
    return new URL(urlText).origin === requestOrigin;
  } catch {
    return false;
  }
}

export function requireSameOriginMutation(request: Request): NextResponse | null {
  const method = request.method.toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return null;
  }

  const requestOrigin = new URL(request.url).origin;
  const secFetchSite = request.headers.get("sec-fetch-site")?.toLowerCase() ?? "";
  if (secFetchSite && !["same-origin", "same-site", "none"].includes(secFetchSite)) {
    return NextResponse.json(
      { title: "Request origin rejected", detail: "Mutation requests must be same-origin." },
      { status: 403 }
    );
  }

  const origin = request.headers.get("origin");
  if (origin && !sameOrigin(origin, requestOrigin)) {
    return NextResponse.json(
      { title: "Request origin rejected", detail: "Mutation requests must be same-origin." },
      { status: 403 }
    );
  }

  const referer = request.headers.get("referer");
  if (!origin && referer && !sameOrigin(referer, requestOrigin)) {
    return NextResponse.json(
      { title: "Request origin rejected", detail: "Mutation requests must be same-origin." },
      { status: 403 }
    );
  }

  return null;
}

export function requireRateLimit(input: {
  bucket: string;
  limit: number;
  windowMs: number;
  title?: string;
}): NextResponse | null {
  const now = Date.now();
  const key = hashBucket(input.bucket);
  const store = rateLimitStore();
  const current = store.get(key);
  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + input.windowMs });
    return null;
  }
  if (current.count >= input.limit) {
    return NextResponse.json(
      { title: input.title ?? "Rate limit exceeded", detail: "Too many requests. Try again later." },
      { status: 429 }
    );
  }
  current.count += 1;
  return null;
}

export function requireMutationRequestSafety(
  request: Request,
  session: ResolvedSession,
  action: string,
  limit = 60
): NextResponse | null {
  return (
    requireSameOriginMutation(request) ??
    requireRateLimit({
      bucket: `mutation:${session.mutationScope.companyId}:${session.mutationScope.appUserId}:${action}`,
      limit,
      windowMs: mutationWindowMs,
      title: "Mutation rate limit exceeded"
    })
  );
}

export function requireDemoLoginRateLimit(request: Request, email: string): NextResponse | null {
  return (
    requireSameOriginMutation(request) ??
    requireRateLimit({
      bucket: `demo-login:${email.trim().toLowerCase() || "empty"}`,
      limit: 6,
      windowMs: loginWindowMs,
      title: "Demo login rate limit exceeded"
    })
  );
}

export function requireApprovalTokenConsumeRateLimit(rawToken: string): NextResponse | null {
  return requireRateLimit({
    bucket: `approval-token-consume:${rawToken}`,
    limit: 6,
    windowMs: mutationWindowMs,
    title: "Approval token rate limit exceeded"
  });
}
