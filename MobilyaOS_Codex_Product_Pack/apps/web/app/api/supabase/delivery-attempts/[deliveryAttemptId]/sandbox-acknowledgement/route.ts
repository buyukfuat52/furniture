import { NextResponse } from "next/server";
import { acknowledgeSandboxDeliveryAttempt } from "../../../../../../lib/server/supabaseRepository";
import { idempotencyKeyFromRequest, reserveIdempotency, storeIdempotencyResult } from "../../../../../../lib/server/idempotency";
import { requireMutationRequestSafety } from "../../../../../../lib/server/requestSecurity";
import { requireBoundary, requireSession, safeError } from "../../../../../../lib/server/routeGuards";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ deliveryAttemptId: string }>;
};

const allowedAcknowledgementBodyKeys = new Set(["idempotency_key"]);

function rejectBrowserAuthority(body: Record<string, unknown>): void {
  const unsupported = Object.keys(body).filter((key) => !allowedAcknowledgementBodyKeys.has(key));
  if (unsupported.length) {
    throw new Error("sandbox acknowledgement request contains unsupported authoritative fields.");
  }
}

function mapSandboxAcknowledgementError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("was not found")) {
    return safeError(404, "Not found", "The requested tenant-scoped delivery attempt was not found.");
  }
  if (
    message.includes("replay") ||
    message.includes("stale") ||
    message.includes("binding") ||
    message.includes("approved") ||
    message.includes("sandbox") ||
    message.includes("attempt")
  ) {
    return safeError(409, "Sandbox acknowledgement blocked", "The sandbox acknowledgement was not accepted for this delivery attempt.");
  }
  if (message.includes("required") || message.includes("invalid") || message.includes("unsupported")) {
    return safeError(422, "Invalid sandbox acknowledgement request", "The sandbox acknowledgement route accepts only an idempotency key.");
  }
  return safeError(404, "Not found", "The requested tenant-scoped delivery attempt was not found.");
}

export async function POST(request: Request, context: RouteContext) {
  const { deliveryAttemptId } = await context.params;
  const session = await requireSession(request);
  if (session instanceof NextResponse) {
    return session;
  }
  const boundary = requireBoundary(session, "acknowledge_sandbox_delivery");
  if (boundary) {
    return boundary;
  }
  const requestSafety = requireMutationRequestSafety(request, session, "quote_sandbox_delivery_acknowledged", 10);
  if (requestSafety) {
    return requestSafety;
  }

  let body: Record<string, unknown>;
  try {
    const parsed = (await request.json()) as unknown;
    body = typeof parsed === "object" && parsed !== null ? parsed as Record<string, unknown> : {};
    rejectBrowserAuthority(body);
  } catch {
    return safeError(422, "Invalid sandbox acknowledgement request", "The sandbox acknowledgement route accepts only an idempotency key.");
  }

  const idempotencyKey = idempotencyKeyFromRequest(request, body);
  if (!idempotencyKey) {
    return safeError(422, "Idempotency key required", "A durable idempotency key is required for this mutation.");
  }

  const reserved = await reserveIdempotency({
    key: idempotencyKey,
    companyId: session.mutationScope.companyId,
    appUserId: session.mutationScope.appUserId,
    action: "quote_sandbox_delivery_acknowledged",
    body
  }).catch(() => null);
  if (!reserved) {
    return safeError(503, "Idempotency unavailable", "The sandbox acknowledgement could not be safely reserved.");
  }
  if ("replayed" in reserved) {
    return NextResponse.json(reserved.body, { status: reserved.status });
  }

  try {
    const delivery_acknowledgement = await acknowledgeSandboxDeliveryAttempt(
      session.mutationScope,
      deliveryAttemptId,
      reserved
    );
    const responseBody = { delivery_acknowledgement };
    await storeIdempotencyResult(reserved, 201, responseBody).catch(() => undefined);
    return NextResponse.json(responseBody, { status: 201 });
  } catch (error) {
    const response = mapSandboxAcknowledgementError(error);
    const responseBody = await response.clone().json().catch(() => ({}));
    await storeIdempotencyResult(reserved, response.status, responseBody).catch(() => undefined);
    return response;
  }
}
