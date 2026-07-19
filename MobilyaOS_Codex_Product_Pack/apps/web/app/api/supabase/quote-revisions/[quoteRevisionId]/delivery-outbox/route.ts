import { NextResponse } from "next/server";
import {
  listQuoteDeliveryOutbox,
  prepareQuoteDeliveryOutbox
} from "../../../../../../lib/server/supabaseRepository";
import { idempotencyKeyFromRequest, reserveIdempotency, storeIdempotencyResult } from "../../../../../../lib/server/idempotency";
import { requireMutationRequestSafety } from "../../../../../../lib/server/requestSecurity";
import { requireBoundary, requireSession, safeError } from "../../../../../../lib/server/routeGuards";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ quoteRevisionId: string }>;
};

const allowedDeliveryBodyKeys = new Set(["idempotency_key"]);

function rejectBrowserAuthority(body: Record<string, unknown>): void {
  const unsupported = Object.keys(body).filter((key) => !allowedDeliveryBodyKeys.has(key));
  if (unsupported.length) {
    throw new Error("delivery outbox request contains unsupported authoritative fields.");
  }
}

function mapDeliveryError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("conflict") || message.includes("approved") || message.includes("artifact") || message.includes("binding") || message.includes("send intent")) {
    return safeError(409, "Delivery outbox conflict", "The approved quote, PDF artifact, or send-intent gates are not ready.");
  }
  if (message.includes("required") || message.includes("invalid") || message.includes("unsupported")) {
    return safeError(422, "Invalid delivery outbox request", "A trusted approved quote, PDF artifact, and send intent are required.");
  }
  return safeError(404, "Not found", "The requested tenant-scoped quote revision was not found.");
}

export async function GET(request: Request, context: RouteContext) {
  const { quoteRevisionId } = await context.params;
  const session = await requireSession(request);
  if (session instanceof NextResponse) {
    return session;
  }
  const boundary = requireBoundary(session, "read_quote_delivery_outbox");
  if (boundary) {
    return boundary;
  }
  try {
    const delivery_outbox = await listQuoteDeliveryOutbox(session.mutationScope, quoteRevisionId);
    return NextResponse.json({ delivery_outbox });
  } catch {
    return safeError(404, "Not found", "The requested tenant-scoped delivery outbox records were not found.");
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { quoteRevisionId } = await context.params;
  const session = await requireSession(request);
  if (session instanceof NextResponse) {
    return session;
  }
  const boundary = requireBoundary(session, "prepare_quote_delivery_outbox");
  if (boundary) {
    return boundary;
  }
  const requestSafety = requireMutationRequestSafety(request, session, "quote_delivery_outbox_prepared", 20);
  if (requestSafety) {
    return requestSafety;
  }

  let body: Record<string, unknown>;
  try {
    const parsed = (await request.json()) as unknown;
    body = typeof parsed === "object" && parsed !== null ? parsed as Record<string, unknown> : {};
    rejectBrowserAuthority(body);
  } catch {
    return safeError(422, "Invalid delivery outbox request", "The delivery outbox route accepts only an idempotency key.");
  }

  const idempotencyKey = idempotencyKeyFromRequest(request, body);
  if (!idempotencyKey) {
    return safeError(422, "Idempotency key required", "A durable idempotency key is required for this mutation.");
  }

  const reserved = await reserveIdempotency({
    key: idempotencyKey,
    companyId: session.mutationScope.companyId,
    appUserId: session.mutationScope.appUserId,
    action: "quote_delivery_outbox_prepared",
    body
  }).catch(() => null);
  if (!reserved) {
    return safeError(503, "Idempotency unavailable", "The delivery outbox preparation could not be safely reserved.");
  }
  if ("replayed" in reserved) {
    return NextResponse.json(reserved.body, { status: reserved.status });
  }

  try {
    const delivery_outbox = await prepareQuoteDeliveryOutbox(session.mutationScope, quoteRevisionId, reserved);
    return NextResponse.json({ delivery_outbox }, { status: 201 });
  } catch (error) {
    const response = mapDeliveryError(error);
    const responseBody = await response.clone().json().catch(() => ({}));
    await storeIdempotencyResult(reserved, response.status, responseBody).catch(() => undefined);
    return response;
  }
}
