import { NextResponse } from "next/server";
import {
  idempotencyKeyFromRequest,
  reserveIdempotency,
  storeIdempotencyResult,
  type IdempotencyReplay,
  type IdempotencyReservation
} from "./idempotency";
import { planProductMutationBoundary, type PlannedMutationKind } from "./productMutationBoundary";
import { requireMutationRequestSafety } from "./requestSecurity";
import { resolveAuthenticatedSession, type ResolvedSession } from "./sessionContext";

export type ApiHandlerContext = {
  session: ResolvedSession;
};

export function safeError(status: 400 | 401 | 403 | 404 | 409 | 422 | 429 | 503, title: string, detail: string): NextResponse {
  return NextResponse.json({ title, detail }, { status });
}

export async function requireSession(request: Request): Promise<ResolvedSession | NextResponse> {
  try {
    const session = await resolveAuthenticatedSession(request);
    if (!session) {
      return safeError(401, "Authentication required", "A valid demo session is required.");
    }
    return session;
  } catch {
    return safeError(401, "Authentication required", "A valid demo session is required.");
  }
}

export function requireBoundary(session: ResolvedSession, kind: PlannedMutationKind): NextResponse | null {
  const decision = planProductMutationBoundary(session.mutationScope, kind);
  if (decision.allowed) {
    return null;
  }
  return safeError(403, "Action not allowed", decision.reason);
}

export async function withReadSession(
  request: Request,
  handler: (context: ApiHandlerContext) => Promise<NextResponse>
): Promise<NextResponse> {
  const session = await requireSession(request);
  if (session instanceof NextResponse) {
    return session;
  }
  try {
    return await handler({ session });
  } catch {
    return safeError(404, "Not found", "The requested tenant-scoped resource was not found.");
  }
}

export async function withMutationSession(
  request: Request,
  kind: PlannedMutationKind,
  action: string,
  handler: (context: ApiHandlerContext, body: Record<string, unknown>, reservation: IdempotencyReservation | null) => Promise<NextResponse>
): Promise<NextResponse> {
  const session = await requireSession(request);
  if (session instanceof NextResponse) {
    return session;
  }
  const boundary = requireBoundary(session, kind);
  if (boundary) {
    return boundary;
  }
  const requestSafety = requireMutationRequestSafety(request, session, action);
  if (requestSafety) {
    return requestSafety;
  }
  let body: Record<string, unknown>;
  try {
    const parsed = (await request.json()) as unknown;
    body = typeof parsed === "object" && parsed !== null ? parsed as Record<string, unknown> : {};
  } catch {
    body = {};
  }
  const idempotencyKey = idempotencyKeyFromRequest(request, body);
  if (!idempotencyKey) {
    return safeError(422, "Idempotency key required", "A durable idempotency key is required for this mutation.");
  }
  let idempotency: IdempotencyReplay | IdempotencyReservation | null;
  try {
    idempotency = await reserveIdempotency({
      key: idempotencyKey,
      companyId: session.mutationScope.companyId,
      appUserId: session.mutationScope.appUserId,
      action,
      body
    });
  } catch {
    return safeError(503, "Idempotency unavailable", "The mutation could not be safely reserved.");
  }
  if (idempotency && "replayed" in idempotency) {
    return NextResponse.json(idempotency.body, { status: idempotency.status });
  }
  const reservation = idempotency ?? null;
  let response: NextResponse;
  try {
    response = await handler({ session }, body, reservation);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("conflict")) {
      response = safeError(409, "Mutation conflict", "The submitted mutation conflicts with the current server state.");
    } else if (message.includes("required") || message.includes("invalid")) {
      response = safeError(422, "Invalid request", "The submitted data could not be accepted.");
    } else {
      response = safeError(404, "Not found", "The requested tenant-scoped resource was not found.");
    }
  }
  const responseBody = await response.clone().json().catch(() => ({}));
  try {
    await storeIdempotencyResult(reservation, response.status, responseBody);
  } catch {
    return safeError(503, "Idempotency unavailable", "The mutation result could not be safely persisted.");
  }
  return NextResponse.json(responseBody, { status: response.status });
}
