import { NextResponse } from "next/server";
import {
  generateStoredQuoteArtifact,
  listQuoteArtifacts
} from "../../../../../../lib/server/supabaseRepository";
import { idempotencyKeyFromRequest, reserveIdempotency, storeIdempotencyResult } from "../../../../../../lib/server/idempotency";
import { requireMutationRequestSafety } from "../../../../../../lib/server/requestSecurity";
import { requireBoundary, requireSession, safeError } from "../../../../../../lib/server/routeGuards";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ quoteRevisionId: string }>;
};

const allowedArtifactBodyKeys = new Set(["idempotency_key"]);

function rejectBrowserAuthority(body: Record<string, unknown>): void {
  const unsupported = Object.keys(body).filter((key) => !allowedArtifactBodyKeys.has(key));
  if (unsupported.length) {
    throw new Error("quote artifact request contains unsupported authoritative fields.");
  }
}

function mapArtifactError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("conflict") || message.includes("approved") || message.includes("binding")) {
    return safeError(409, "Artifact conflict", "The quote revision, approval, document, or artifact binding is not ready.");
  }
  if (message.includes("required") || message.includes("invalid") || message.includes("unsupported")) {
    return safeError(422, "Invalid artifact request", "A trusted approved quote and frozen document are required.");
  }
  return safeError(404, "Not found", "The requested tenant-scoped quote revision was not found.");
}

export async function GET(request: Request, context: RouteContext) {
  const { quoteRevisionId } = await context.params;
  const session = await requireSession(request);
  if (session instanceof NextResponse) {
    return session;
  }
  const boundary = requireBoundary(session, "read_quote_artifact");
  if (boundary) {
    return boundary;
  }
  try {
    const artifacts = await listQuoteArtifacts(session.mutationScope, quoteRevisionId);
    return NextResponse.json({ artifacts });
  } catch {
    return safeError(404, "Not found", "The requested tenant-scoped quote artifacts were not found.");
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { quoteRevisionId } = await context.params;
  const session = await requireSession(request);
  if (session instanceof NextResponse) {
    return session;
  }
  const boundary = requireBoundary(session, "generate_quote_artifact");
  if (boundary) {
    return boundary;
  }
  const requestSafety = requireMutationRequestSafety(request, session, "quote_artifact_stored", 20);
  if (requestSafety) {
    return requestSafety;
  }

  let body: Record<string, unknown>;
  try {
    const parsed = (await request.json()) as unknown;
    body = typeof parsed === "object" && parsed !== null ? parsed as Record<string, unknown> : {};
    rejectBrowserAuthority(body);
  } catch {
    return safeError(422, "Invalid artifact request", "The artifact route accepts only an idempotency key.");
  }

  const idempotencyKey = idempotencyKeyFromRequest(request, body);
  if (!idempotencyKey) {
    return safeError(422, "Idempotency key required", "A durable idempotency key is required for this mutation.");
  }

  const reserved = await reserveIdempotency({
    key: idempotencyKey,
    companyId: session.mutationScope.companyId,
    appUserId: session.mutationScope.appUserId,
    action: "quote_artifact_stored",
    body
  }).catch(() => null);
  if (!reserved) {
    return safeError(503, "Idempotency unavailable", "The artifact generation could not be safely reserved.");
  }
  if ("replayed" in reserved) {
    return NextResponse.json(reserved.body, { status: reserved.status });
  }

  try {
    const artifact = await generateStoredQuoteArtifact(session.mutationScope, quoteRevisionId, reserved);
    return NextResponse.json({ artifact }, { status: 201 });
  } catch (error) {
    const response = mapArtifactError(error);
    const responseBody = await response.clone().json().catch(() => ({}));
    await storeIdempotencyResult(reserved, response.status, responseBody).catch(() => undefined);
    return response;
  }
}
