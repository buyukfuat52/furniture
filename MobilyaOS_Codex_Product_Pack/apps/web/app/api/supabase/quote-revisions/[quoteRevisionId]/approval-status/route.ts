import { NextResponse } from "next/server";
import { getApprovalGateStatus } from "../../../../../../lib/server/supabaseRepository";
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
  const boundary = requireBoundary(session, "read_approval_status");
  if (boundary) {
    return boundary;
  }
  try {
    const approval_gate = await getApprovalGateStatus(session.mutationScope, quoteRevisionId);
    return NextResponse.json({ approval_gate });
  } catch {
    return safeError(404, "Not found", "The requested tenant-scoped approval status was not found.");
  }
}
