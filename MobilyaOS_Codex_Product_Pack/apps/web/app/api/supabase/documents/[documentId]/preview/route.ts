import { NextResponse } from "next/server";
import { getQuoteDocumentArtifact } from "../../../../../../lib/server/supabaseRepository";
import { requireBoundary, requireSession, safeError } from "../../../../../../lib/server/routeGuards";

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
    const document = await getQuoteDocumentArtifact(session.mutationScope, documentId);
    return new NextResponse(document.html, {
      status: 200,
      headers: {
        "Content-Type": document.content_type,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'; sandbox"
      }
    });
  } catch {
    return safeError(404, "Not found", "The requested tenant-scoped document artifact was not found.");
  }
}
