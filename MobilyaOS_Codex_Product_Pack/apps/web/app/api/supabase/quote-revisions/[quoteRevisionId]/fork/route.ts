import { NextResponse } from "next/server";
import { forkQuoteRevision } from "../../../../../../lib/server/supabaseRepository";
import { idempotencyKeyFromRequest, reserveIdempotency, storeIdempotencyResult } from "../../../../../../lib/server/idempotency";
import { requireMutationRequestSafety } from "../../../../../../lib/server/requestSecurity";
import { requireBoundary, requireSession, safeError } from "../../../../../../lib/server/routeGuards";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ quoteRevisionId: string }>;
};

const allowedForkBodyKeys = new Set(["expected_revision_version", "idempotency_key"]);

function parseExpectedRevisionVersion(value: unknown): number {
  const parsed = typeof value === "number" && Number.isInteger(value)
    ? value
    : typeof value === "string" && /^\d+$/.test(value.trim())
      ? Number(value.trim())
      : NaN;
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 1_000_000) {
    throw new Error("expected_revision_version is required.");
  }
  return parsed;
}

function rejectBrowserAuthority(body: Record<string, unknown>): void {
  const unsupported = Object.keys(body).filter((key) => !allowedForkBodyKeys.has(key));
  if (unsupported.length) {
    throw new Error("revision fork contains unsupported authoritative fields.");
  }
}

function mapForkError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("conflict")) {
    return safeError(409, "Fork conflict", "The source revision changed before the fork could be created.");
  }
  if (message.includes("required") || message.includes("invalid") || message.includes("unsupported")) {
    return safeError(422, "Invalid fork request", "The source revision version is required for a fork.");
  }
  return safeError(404, "Not found", "The requested tenant-scoped quote revision was not found.");
}

export async function POST(request: Request, context: RouteContext) {
  const { quoteRevisionId } = await context.params;
  const session = await requireSession(request);
  if (session instanceof NextResponse) {
    return session;
  }
  const boundary = requireBoundary(session, "fork_quote_revision");
  if (boundary) {
    return boundary;
  }
  const requestSafety = requireMutationRequestSafety(request, session, "quote_revision_forked", 20);
  if (requestSafety) {
    return requestSafety;
  }

  let body: Record<string, unknown>;
  let expectedRevisionVersion: number;
  try {
    const parsed = (await request.json()) as unknown;
    body = typeof parsed === "object" && parsed !== null ? parsed as Record<string, unknown> : {};
    rejectBrowserAuthority(body);
    expectedRevisionVersion = parseExpectedRevisionVersion(body.expected_revision_version);
  } catch {
    return safeError(422, "Invalid fork request", "The fork route accepts only a source revision version and idempotency key.");
  }

  const idempotencyKey = idempotencyKeyFromRequest(request, body);
  if (!idempotencyKey) {
    return safeError(422, "Idempotency key required", "A durable idempotency key is required for this mutation.");
  }

  const reserved = await reserveIdempotency({
    key: idempotencyKey,
    companyId: session.mutationScope.companyId,
    appUserId: session.mutationScope.appUserId,
    action: "quote_revision_forked",
    body
  }).catch(() => null);
  if (!reserved) {
    return safeError(503, "Idempotency unavailable", "The revision fork could not be safely reserved.");
  }
  if ("replayed" in reserved) {
    return NextResponse.json(reserved.body, { status: reserved.status });
  }

  try {
    const response = await forkQuoteRevision(session.mutationScope, quoteRevisionId, expectedRevisionVersion, reserved);
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    const response = mapForkError(error);
    const responseBody = await response.clone().json().catch(() => ({}));
    await storeIdempotencyResult(reserved, response.status, responseBody).catch(() => undefined);
    return response;
  }
}
