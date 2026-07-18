import { NextResponse } from "next/server";
import {
  getQuoteConfigurationDraft,
  getQuoteRevision,
  persistQuoteCalculationResult
} from "../../../../../../lib/server/supabaseRepository";
import { calculateWardrobeQuoteSnapshot } from "../../../../../../lib/server/quoteCalculation";
import { requireBoundary, requireSession, safeError } from "../../../../../../lib/server/routeGuards";
import { requireMutationRequestSafety } from "../../../../../../lib/server/requestSecurity";
import {
  idempotencyKeyFromRequest,
  reserveIdempotency,
  type IdempotencyReplay,
  type IdempotencyReservation
} from "../../../../../../lib/server/idempotency";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ quoteRevisionId: string }>;
};

const allowedBodyKeys = new Set(["expected_configuration_version", "idempotency_key"]);

function parseExpectedConfigurationVersion(value: unknown): number {
  const parsed = typeof value === "number" && Number.isInteger(value)
    ? value
    : typeof value === "string" && /^\d+$/.test(value.trim())
      ? Number(value.trim())
      : NaN;
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 1_000_000) {
    throw new Error("expected_configuration_version is required.");
  }
  return parsed;
}

function rejectBrowserAuthority(body: Record<string, unknown>): void {
  const unsupported = Object.keys(body).filter((key) => !allowedBodyKeys.has(key));
  if (unsupported.length) {
    throw new Error("calculate request contains unsupported authoritative fields.");
  }
}

function mapCalculationError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("conflict")) {
    return safeError(409, "Calculation conflict", "The quote revision or configuration draft changed before calculation could be persisted.");
  }
  if (
    message.includes("required") ||
    message.includes("unsupported") ||
    message.includes("outside") ||
    message.includes("Only wardrobe") ||
    message.includes("Material")
  ) {
    return safeError(422, "Invalid calculation request", "The saved configuration draft cannot be calculated by this deterministic slice.");
  }
  return safeError(404, "Not found", "The requested tenant-scoped quote revision was not found.");
}

export async function POST(request: Request, context: RouteContext) {
  const { quoteRevisionId } = await context.params;
  const session = await requireSession(request);
  if (session instanceof NextResponse) {
    return session;
  }
  const boundary = requireBoundary(session, "calculate_quote_snapshot");
  if (boundary) {
    return boundary;
  }
  const requestSafety = requireMutationRequestSafety(request, session, "quote_snapshot_calculated", 30);
  if (requestSafety) {
    return requestSafety;
  }

  let body: Record<string, unknown>;
  try {
    const parsed = (await request.json()) as unknown;
    body = typeof parsed === "object" && parsed !== null ? parsed as Record<string, unknown> : {};
    rejectBrowserAuthority(body);
  } catch {
    return safeError(422, "Invalid calculation request", "The calculate route accepts only the saved configuration version.");
  }

  const idempotencyKey = idempotencyKeyFromRequest(request, body);
  if (!idempotencyKey) {
    return safeError(422, "Idempotency key required", "A durable idempotency key is required for this mutation.");
  }

  let expectedConfigurationVersion: number;
  try {
    expectedConfigurationVersion = parseExpectedConfigurationVersion(body.expected_configuration_version);
  } catch {
    return safeError(422, "Invalid calculation request", "The saved configuration version is required.");
  }

  try {
    const quoteRevision = await getQuoteRevision(session.mutationScope, quoteRevisionId);
    if (quoteRevision.status !== "draft") {
      return safeError(409, "Calculation conflict", "Only draft quote revisions can be calculated by this slice.");
    }
    const configurationDraft = await getQuoteConfigurationDraft(session.mutationScope, quoteRevision.id);
    if (!configurationDraft) {
      return safeError(422, "Configuration required", "A saved configuration draft is required before deterministic calculation.");
    }
    if (configurationDraft.version !== expectedConfigurationVersion) {
      return safeError(409, "Calculation conflict", "The saved configuration draft version is stale.");
    }
    const calculation = calculateWardrobeQuoteSnapshot({ quoteRevision, configurationDraft });

    let idempotency: IdempotencyReplay | IdempotencyReservation | null;
    try {
      idempotency = await reserveIdempotency({
        key: idempotencyKey,
        companyId: session.mutationScope.companyId,
        appUserId: session.mutationScope.appUserId,
        action: "quote_snapshot_calculated",
        body
      });
    } catch {
      return safeError(503, "Idempotency unavailable", "The calculation could not be safely reserved.");
    }
    if (idempotency && "replayed" in idempotency) {
      return NextResponse.json(idempotency.body, { status: idempotency.status });
    }
    if (!idempotency) {
      return safeError(503, "Idempotency unavailable", "The calculation could not be safely reserved.");
    }

    const response = await persistQuoteCalculationResult(session.mutationScope, calculation, idempotency);
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    return mapCalculationError(error);
  }
}
