import { NextResponse } from "next/server";
import {
  listQuoteDeliveryAttempts,
  recordQuoteDeliveryAttempt
} from "../../../../../../lib/server/supabaseRepository";
import { idempotencyKeyFromRequest, reserveIdempotency, storeIdempotencyResult } from "../../../../../../lib/server/idempotency";
import { requireMutationRequestSafety } from "../../../../../../lib/server/requestSecurity";
import { requireBoundary, requireSession, safeError } from "../../../../../../lib/server/routeGuards";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ quoteRevisionId: string }>;
};

const allowedAttemptBodyKeys = new Set(["idempotency_key"]);

function rejectBrowserAuthority(body: Record<string, unknown>): void {
  const unsupported = Object.keys(body).filter((key) => !allowedAttemptBodyKeys.has(key));
  if (unsupported.length) {
    throw new Error("delivery attempt request contains unsupported authoritative fields.");
  }
}

function mapDeliveryAttemptError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "";
  if (
    message.includes("conflict") ||
    message.includes("approved") ||
    message.includes("outbox") ||
    message.includes("artifact") ||
    message.includes("binding") ||
    message.includes("provider") ||
    message.includes("send intent")
  ) {
    return safeError(409, "Delivery attempt blocked", "The provider boundary is not verified, so the quote was not sent.");
  }
  if (message.includes("required") || message.includes("invalid") || message.includes("unsupported")) {
    return safeError(422, "Invalid delivery attempt request", "The delivery-attempt route accepts only an idempotency key.");
  }
  return safeError(404, "Not found", "The requested tenant-scoped quote revision was not found.");
}

export async function GET(request: Request, context: RouteContext) {
  const { quoteRevisionId } = await context.params;
  const session = await requireSession(request);
  if (session instanceof NextResponse) {
    return session;
  }
  const boundary = requireBoundary(session, "read_quote_delivery_attempt");
  if (boundary) {
    return boundary;
  }
  try {
    const delivery_attempts = await listQuoteDeliveryAttempts(session.mutationScope, quoteRevisionId);
    return NextResponse.json({ delivery_attempts });
  } catch {
    return safeError(404, "Not found", "The requested tenant-scoped delivery attempt records were not found.");
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { quoteRevisionId } = await context.params;
  const session = await requireSession(request);
  if (session instanceof NextResponse) {
    return session;
  }
  const boundary = requireBoundary(session, "record_quote_delivery_attempt");
  if (boundary) {
    return boundary;
  }
  const requestSafety = requireMutationRequestSafety(request, session, "quote_delivery_attempt_recorded", 20);
  if (requestSafety) {
    return requestSafety;
  }

  let body: Record<string, unknown>;
  try {
    const parsed = (await request.json()) as unknown;
    body = typeof parsed === "object" && parsed !== null ? parsed as Record<string, unknown> : {};
    rejectBrowserAuthority(body);
  } catch {
    return safeError(422, "Invalid delivery attempt request", "The delivery-attempt route accepts only an idempotency key.");
  }

  const idempotencyKey = idempotencyKeyFromRequest(request, body);
  if (!idempotencyKey) {
    return safeError(422, "Idempotency key required", "A durable idempotency key is required for this mutation.");
  }

  const reserved = await reserveIdempotency({
    key: idempotencyKey,
    companyId: session.mutationScope.companyId,
    appUserId: session.mutationScope.appUserId,
    action: "quote_delivery_attempt_recorded",
    body
  }).catch(() => null);
  if (!reserved) {
    return safeError(503, "Idempotency unavailable", "The delivery attempt could not be safely reserved.");
  }
  if ("replayed" in reserved) {
    return NextResponse.json(reserved.body, { status: reserved.status });
  }

  try {
    const delivery_attempt = await recordQuoteDeliveryAttempt(session.mutationScope, quoteRevisionId, reserved);
    const responseBody = { delivery_attempt };
    await storeIdempotencyResult(reserved, 201, responseBody).catch(() => undefined);
    return NextResponse.json(responseBody, { status: 201 });
  } catch (error) {
    const response = mapDeliveryAttemptError(error);
    const responseBody = await response.clone().json().catch(() => ({}));
    await storeIdempotencyResult(reserved, response.status, responseBody).catch(() => undefined);
    return response;
  }
}
