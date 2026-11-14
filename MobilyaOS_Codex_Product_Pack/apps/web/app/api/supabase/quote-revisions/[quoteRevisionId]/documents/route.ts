import { NextResponse } from "next/server";
import {
  generateQuoteDocument,
  listQuoteDocuments
} from "../../../../../../lib/server/supabaseRepository";
import { idempotencyKeyFromRequest, reserveIdempotency, storeIdempotencyResult } from "../../../../../../lib/server/idempotency";
import { requireMutationRequestSafety } from "../../../../../../lib/server/requestSecurity";
import { requireBoundary, requireSession, safeError } from "../../../../../../lib/server/routeGuards";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ quoteRevisionId: string }>;
};

const allowedGenerateBodyKeys = new Set(["idempotency_key"]);

function rejectBrowserAuthority(body: Record<string, unknown>): void {
  const unsupported = Object.keys(body).filter((key) => !allowedGenerateBodyKeys.has(key));
  if (unsupported.length) {
    throw new Error("quote document generation contains unsupported authoritative fields.");
  }
}

function mapDocumentError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("conflict")) {
    return safeError(409, "Document conflict", "The quote revision or snapshot changed before document generation completed.");
  }
  if (message.includes("required") || message.includes("invalid") || message.includes("unsupported")) {
    return safeError(422, "Invalid document request", "A trusted calculated snapshot is required for frozen document generation.");
  }
  return safeError(404, "Not found", "The requested tenant-scoped quote revision was not found.");
}

export async function GET(request: Request, context: RouteContext) {
  const { quoteRevisionId } = await context.params;
  const session = await requireSession(request);
  if (session instanceof NextResponse) {
    return session;
  }
  const boundary = requireBoundary(session, "read_quote_document");
  if (boundary) {
    return boundary;
  }
  try {
    const documents = await listQuoteDocuments(session.mutationScope, quoteRevisionId);
    return NextResponse.json({ documents });
  } catch {
    return safeError(404, "Not found", "The requested tenant-scoped quote revision was not found.");
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { quoteRevisionId } = await context.params;
  const session = await requireSession(request);
  if (session instanceof NextResponse) {
    return session;
  }
  const boundary = requireBoundary(session, "generate_frozen_quote_document");
  if (boundary) {
    return boundary;
  }
  const requestSafety = requireMutationRequestSafety(request, session, "quote_document_generated", 20);
  if (requestSafety) {
    return requestSafety;
  }

  let body: Record<string, unknown>;
  try {
    const parsed = (await request.json()) as unknown;
    body = typeof parsed === "object" && parsed !== null ? parsed as Record<string, unknown> : {};
    rejectBrowserAuthority(body);
  } catch {
    return safeError(422, "Invalid document request", "The document route accepts only an idempotency key.");
  }

  const idempotencyKey = idempotencyKeyFromRequest(request, body);
  if (!idempotencyKey) {
    return safeError(422, "Idempotency key required", "A durable idempotency key is required for this mutation.");
  }

  const reserved = await reserveIdempotency({
    key: idempotencyKey,
    companyId: session.mutationScope.companyId,
    appUserId: session.mutationScope.appUserId,
    action: "quote_document_generated",
    body,
    resource: { type: "quote_revision", id: quoteRevisionId, version: "quote-document-v1.0.0" }
  }).catch(() => null);
  if (!reserved) {
    return safeError(503, "Idempotency unavailable", "The document generation could not be safely reserved.");
  }
  if ("replayed" in reserved) {
    return NextResponse.json(reserved.body, { status: reserved.status });
  }

  try {
    const document = await generateQuoteDocument(session.mutationScope, quoteRevisionId, reserved);
    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    const response = mapDocumentError(error);
    const responseBody = await response.clone().json().catch(() => ({}));
    await storeIdempotencyResult(reserved, response.status, responseBody).catch(() => undefined);
    return response;
  }
}
