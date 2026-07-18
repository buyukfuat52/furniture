import { NextResponse } from "next/server";
import { reserveIdempotency, storeIdempotencyResult, type IdempotencyReservation } from "./idempotency";
import { planProductMutationBoundary, type PlannedMutationKind } from "./productMutationBoundary";
import { resolveAuthenticatedSession, type ResolvedSession } from "./sessionContext";

export type ApiHandlerContext = {
  session: ResolvedSession;
};

export function safeError(status: 401 | 403 | 404 | 409 | 422 | 503, title: string, detail: string): NextResponse {
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
  let body: Record<string, unknown>;
  try {
    const parsed = (await request.json()) as unknown;
    body = typeof parsed === "object" && parsed !== null ? parsed as Record<string, unknown> : {};
  } catch {
    body = {};
  }
  const idempotency = reserveIdempotency({
    key: request.headers.get("x-idempotency-key") ?? request.headers.get("idempotency-key") ?? (typeof body.idempotency_key === "string" ? body.idempotency_key : null),
    companyId: session.mutationScope.companyId,
    appUserId: session.mutationScope.appUserId,
    action,
    body
  });
  if (idempotency && "replayed" in idempotency) {
    return NextResponse.json(idempotency.body, { status: idempotency.status });
  }
  const reservation = idempotency ?? null;
  try {
    const response = await handler({ session }, body, reservation);
    const responseBody = await response.clone().json().catch(() => ({}));
    storeIdempotencyResult(reservation, response.status, responseBody);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("required") || message.includes("invalid")) {
      return safeError(422, "Invalid request", "The submitted data could not be accepted.");
    }
    return safeError(404, "Not found", "The requested tenant-scoped resource was not found.");
  }
}
