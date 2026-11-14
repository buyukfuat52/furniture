import { NextResponse } from "next/server";
import { prepareApprovalGate } from "../../../../../../lib/server/supabaseRepository";
import { idempotencyKeyFromRequest, reserveIdempotency, storeIdempotencyResult } from "../../../../../../lib/server/idempotency";
import { requireMutationRequestSafety } from "../../../../../../lib/server/requestSecurity";
import { requireBoundary, requireSession, safeError } from "../../../../../../lib/server/routeGuards";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ quoteRevisionId: string }>;
};

const allowedApprovalBodyKeys = new Set(["document_id", "idempotency_key"]);

function rejectBrowserAuthority(body: Record<string, unknown>): void {
  const unsupported = Object.keys(body).filter((key) => !allowedApprovalBodyKeys.has(key));
  if (unsupported.length) {
    throw new Error("approval gate request contains unsupported authoritative fields.");
  }
}

function documentIdFromBody(body: Record<string, unknown>): string | null {
  if (body.document_id === undefined || body.document_id === null || body.document_id === "") {
    return null;
  }
  if (typeof body.document_id !== "string") {
    throw new Error("document_id is invalid.");
  }
  return body.document_id;
}

function mapApprovalError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("conflict")) {
    return safeError(409, "Approval gate conflict", "The quote revision changed before approval preparation completed.");
  }
  if (message.includes("required") || message.includes("invalid") || message.includes("unsupported")) {
    return safeError(422, "Invalid approval gate request", "A trusted document bound to the current snapshot is required.");
  }
  return safeError(404, "Not found", "The requested tenant-scoped quote revision or document was not found.");
}

export async function POST(request: Request, context: RouteContext) {
  const { quoteRevisionId } = await context.params;
  const session = await requireSession(request);
  if (session instanceof NextResponse) {
    return session;
  }
  const boundary = requireBoundary(session, "prepare_quote_approval_token");
  if (boundary) {
    return boundary;
  }
  const requestSafety = requireMutationRequestSafety(request, session, "quote_approval_gate_prepared", 20);
  if (requestSafety) {
    return requestSafety;
  }

  let body: Record<string, unknown>;
  let documentId: string | null;
  try {
    const parsed = (await request.json()) as unknown;
    body = typeof parsed === "object" && parsed !== null ? parsed as Record<string, unknown> : {};
    rejectBrowserAuthority(body);
    documentId = documentIdFromBody(body);
  } catch {
    return safeError(422, "Invalid approval gate request", "The approval route accepts only a document id and idempotency key.");
  }

  const idempotencyKey = idempotencyKeyFromRequest(request, body);
  if (!idempotencyKey) {
    return safeError(422, "Idempotency key required", "A durable idempotency key is required for this mutation.");
  }

  const reserved = await reserveIdempotency({
    key: idempotencyKey,
    companyId: session.mutationScope.companyId,
    appUserId: session.mutationScope.appUserId,
    action: "quote_approval_gate_prepared",
    body,
    resource: { type: "quote_revision", id: quoteRevisionId, version: documentId ?? "document-required" }
  }).catch(() => null);
  if (!reserved) {
    return safeError(503, "Idempotency unavailable", "The approval gate could not be safely reserved.");
  }
  if ("replayed" in reserved) {
    return NextResponse.json(reserved.body, { status: reserved.status });
  }

  try {
    const approval_gate = await prepareApprovalGate(session.mutationScope, quoteRevisionId, documentId, reserved);
    return NextResponse.json({ approval_gate }, { status: 201 });
  } catch (error) {
    const response = mapApprovalError(error);
    const responseBody = await response.clone().json().catch(() => ({}));
    await storeIdempotencyResult(reserved, response.status, responseBody).catch(() => undefined);
    return response;
  }
}
