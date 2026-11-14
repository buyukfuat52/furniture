import { NextResponse } from "next/server";
import { generateStoredQuotePdfArtifact } from "../../../../../../../lib/server/supabaseRepository";
import { idempotencyKeyFromRequest, reserveIdempotency, storeIdempotencyResult } from "../../../../../../../lib/server/idempotency";
import { requireMutationRequestSafety } from "../../../../../../../lib/server/requestSecurity";
import { requireBoundary, requireSession, safeError } from "../../../../../../../lib/server/routeGuards";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ quoteRevisionId: string }>;
};

const allowedPdfArtifactBodyKeys = new Set(["idempotency_key"]);

function rejectBrowserAuthority(body: Record<string, unknown>): void {
  const unsupported = Object.keys(body).filter((key) => !allowedPdfArtifactBodyKeys.has(key));
  if (unsupported.length) {
    throw new Error("PDF artifact request contains unsupported authoritative fields.");
  }
}

function mapPdfArtifactError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("Supabase storage upload failed")) {
    return safeError(503, "PDF artifact storage unavailable", message);
  }
  if (message.includes("Supabase repository request failed")) {
    return safeError(409, "PDF artifact persistence conflict", message);
  }
  if (message.includes("conflict") || message.includes("approved") || message.includes("binding") || message.includes("stored HTML")) {
    return safeError(409, "PDF artifact conflict", "The approved quote, frozen document, HTML artifact, or snapshot binding is not ready.");
  }
  if (message.includes("required") || message.includes("invalid") || message.includes("unsupported")) {
    return safeError(422, "Invalid PDF artifact request", "A trusted approved quote and stored HTML artifact are required.");
  }
  return safeError(404, "Not found", "The requested tenant-scoped quote revision was not found.");
}

export async function POST(request: Request, context: RouteContext) {
  const { quoteRevisionId } = await context.params;
  const session = await requireSession(request);
  if (session instanceof NextResponse) {
    return session;
  }
  const boundary = requireBoundary(session, "generate_quote_pdf_artifact");
  if (boundary) {
    return boundary;
  }
  const requestSafety = requireMutationRequestSafety(request, session, "quote_pdf_artifact_generated", 20);
  if (requestSafety) {
    return requestSafety;
  }

  let body: Record<string, unknown>;
  try {
    const parsed = (await request.json()) as unknown;
    body = typeof parsed === "object" && parsed !== null ? parsed as Record<string, unknown> : {};
    rejectBrowserAuthority(body);
  } catch {
    return safeError(422, "Invalid PDF artifact request", "The PDF artifact route accepts only an idempotency key.");
  }

  const idempotencyKey = idempotencyKeyFromRequest(request, body);
  if (!idempotencyKey) {
    return safeError(422, "Idempotency key required", "A durable idempotency key is required for this mutation.");
  }

  const reserved = await reserveIdempotency({
    key: idempotencyKey,
    companyId: session.mutationScope.companyId,
    appUserId: session.mutationScope.appUserId,
    action: "quote_pdf_artifact_generated",
    body,
    resource: { type: "quote_revision", id: quoteRevisionId, version: "quote-pdf-artifact-v1.0.0" }
  }).catch(() => null);
  if (!reserved) {
    return safeError(503, "Idempotency unavailable", "The PDF artifact generation could not be safely reserved.");
  }
  if ("replayed" in reserved) {
    return NextResponse.json(reserved.body, { status: reserved.status });
  }

  try {
    const artifact = await generateStoredQuotePdfArtifact(session.mutationScope, quoteRevisionId, reserved);
    return NextResponse.json({ artifact }, { status: 201 });
  } catch (error) {
    const response = mapPdfArtifactError(error);
    const responseBody = await response.clone().json().catch(() => ({}));
    await storeIdempotencyResult(reserved, response.status, responseBody).catch(() => undefined);
    return response;
  }
}
