import { NextResponse } from "next/server";
import { getQuoteDocument } from "../../../../../lib/server/supabaseRepository";
import { requireBoundary, requireSession, safeError } from "../../../../../lib/server/routeGuards";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ documentId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { documentId } = await context.params;
  const session = await requireSession(request);
  if (session instanceof NextResponse) {
    return session;
  }
  const boundary = requireBoundary(session, "read_quote_document");
  if (boundary) {
    return boundary;
  }
  try {
    const document = await getQuoteDocument(session.mutationScope, documentId);
    return NextResponse.json({ document });
  } catch {
    return safeError(404, "Not found", "The requested tenant-scoped document was not found.");
  }
}
