import { NextResponse } from "next/server";
import { listQuoteDeliveryAcknowledgements } from "../../../../../../lib/server/supabaseRepository";
import { requireBoundary, requireSession, safeError } from "../../../../../../lib/server/routeGuards";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ quoteRevisionId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { quoteRevisionId } = await context.params;
  const session = await requireSession(request);
  if (session instanceof NextResponse) {
    return session;
  }
  const boundary = requireBoundary(session, "read_quote_delivery_acknowledgement");
  if (boundary) {
    return boundary;
  }
  try {
    const delivery_acknowledgements = await listQuoteDeliveryAcknowledgements(session.mutationScope, quoteRevisionId);
    return NextResponse.json({ delivery_acknowledgements });
  } catch {
    return safeError(404, "Not found", "The requested tenant-scoped delivery acknowledgement records were not found.");
  }
}
