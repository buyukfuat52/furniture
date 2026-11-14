import { NextResponse } from "next/server";
import { listQuoteSendIntents, prepareQuoteSendIntent } from "../../../../../../lib/server/supabaseRepository";
import { idempotencyKeyFromRequest, reserveIdempotency, storeIdempotencyResult } from "../../../../../../lib/server/idempotency";
import { requireMutationRequestSafety } from "../../../../../../lib/server/requestSecurity";
import { requireBoundary, requireSession, safeError } from "../../../../../../lib/server/routeGuards";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ quoteRevisionId: string }>;
};

const allowedSendIntentBodyKeys = new Set(["idempotency_key"]);

function rejectBrowserAuthority(body: Record<string, unknown>): void {
  const unsupported = Object.keys(body).filter((key) => !allowedSendIntentBodyKeys.has(key));
  if (unsupported.length) {
    throw new Error("send intent request contains unsupported authoritative fields.");
  }
}

function mapSendIntentError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("conflict") || message.includes("approved") || message.includes("artifact") || message.includes("binding")) {
    return safeError(409, "Send intent conflict", "The approved quote and stored artifact gates are not ready.");
  }
  if (message.includes("required") || message.includes("invalid") || message.includes("unsupported")) {
    return safeError(422, "Invalid send intent request", "A trusted approved quote and stored artifact are required.");
  }
  return safeError(404, "Not found", "The requested tenant-scoped quote revision was not found.");
}

export async function GET(request: Request, context: RouteContext) {
  const { quoteRevisionId } = await context.params;
  const session = await requireSession(request);
  if (session instanceof NextResponse) {
    return session;
  }
  const boundary = requireBoundary(session, "read_quote_send_intent");
  if (boundary) {
    return boundary;
  }
  try {
    const send_intents = await listQuoteSendIntents(session.mutationScope, quoteRevisionId);
    return NextResponse.json({ send_intents });
  } catch {
    return safeError(404, "Not found", "The requested tenant-scoped quote send intents were not found.");
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { quoteRevisionId } = await context.params;
  const session = await requireSession(request);
  if (session instanceof NextResponse) {
    return session;
  }
  const boundary = requireBoundary(session, "prepare_quote_send_intent");
  if (boundary) {
    return boundary;
  }
  const requestSafety = requireMutationRequestSafety(request, session, "quote_send_intent_prepared", 20);
  if (requestSafety) {
    return requestSafety;
  }

  let body: Record<string, unknown>;
  try {
    const parsed = (await request.json()) as unknown;
    body = typeof parsed === "object" && parsed !== null ? parsed as Record<string, unknown> : {};
    rejectBrowserAuthority(body);
  } catch {
    return safeError(422, "Invalid send intent request", "The send-intent route accepts only an idempotency key.");
  }

  const idempotencyKey = idempotencyKeyFromRequest(request, body);
  if (!idempotencyKey) {
    return safeError(422, "Idempotency key required", "A durable idempotency key is required for this mutation.");
  }

  const reserved = await reserveIdempotency({
    key: idempotencyKey,
    companyId: session.mutationScope.companyId,
    appUserId: session.mutationScope.appUserId,
    action: "quote_send_intent_prepared",
    body,
    resource: { type: "quote_revision", id: quoteRevisionId, version: "quote-send-intent-v1.0.0" }
  }).catch(() => null);
  if (!reserved) {
    return safeError(503, "Idempotency unavailable", "The send-intent preparation could not be safely reserved.");
  }
  if ("replayed" in reserved) {
    return NextResponse.json(reserved.body, { status: reserved.status });
  }

  try {
    const send_intent = await prepareQuoteSendIntent(session.mutationScope, quoteRevisionId, reserved);
    const body = { send_intent };
    await storeIdempotencyResult(reserved, 201, body).catch(() => undefined);
    return NextResponse.json(body, { status: 201 });
  } catch (error) {
    const response = mapSendIntentError(error);
    const responseBody = await response.clone().json().catch(() => ({}));
    await storeIdempotencyResult(reserved, response.status, responseBody).catch(() => undefined);
    return response;
  }
}
