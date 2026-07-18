import { NextResponse } from "next/server";
import { getQuoteRevisionDiff } from "../../../../../../lib/server/supabaseRepository";
import { requireBoundary, requireSession, safeError } from "../../../../../../lib/server/routeGuards";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ quoteRevisionId: string }>;
};

const allowedQueryKeys = new Set(["against"]);

function rejectUnsupportedQuery(searchParams: URLSearchParams): void {
  for (const key of searchParams.keys()) {
    if (!allowedQueryKeys.has(key)) {
      throw new Error("revision diff contains unsupported authoritative fields.");
    }
  }
}

export async function GET(request: Request, context: RouteContext) {
  const { quoteRevisionId } = await context.params;
  const session = await requireSession(request);
  if (session instanceof NextResponse) {
    return session;
  }
  const boundary = requireBoundary(session, "read_revision_diff");
  if (boundary) {
    return boundary;
  }
  const searchParams = new URL(request.url).searchParams;
  try {
    rejectUnsupportedQuery(searchParams);
  } catch {
    return safeError(422, "Invalid diff request", "The diff route accepts only an against revision id.");
  }
  const against = searchParams.get("against") ?? "";
  if (!against) {
    return safeError(422, "Invalid diff request", "An against revision id is required.");
  }
  try {
    const diff = await getQuoteRevisionDiff(session.mutationScope, quoteRevisionId, against);
    return NextResponse.json({ diff });
  } catch {
    return safeError(404, "Not found", "The requested tenant-scoped revision diff was not found.");
  }
}
