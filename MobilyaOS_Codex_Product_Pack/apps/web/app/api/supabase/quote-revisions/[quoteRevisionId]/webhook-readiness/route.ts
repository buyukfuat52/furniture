import { NextResponse } from "next/server";
import { getProviderWebhookReadinessForRevision } from "../../../../../../lib/server/supabaseRepository";
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
  const boundary = requireBoundary(session, "read_webhook_readiness");
  if (boundary) {
    return boundary;
  }
  try {
    const webhook_readiness = await getProviderWebhookReadinessForRevision(session.mutationScope, quoteRevisionId);
    return NextResponse.json({ webhook_readiness });
  } catch {
    return safeError(404, "Not found", "The requested tenant-scoped webhook readiness was not found.");
  }
}
