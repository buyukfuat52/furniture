import { NextResponse } from "next/server";
import { getQuoteArtifact } from "../../../../../lib/server/supabaseRepository";
import { requireBoundary, requireSession, safeError } from "../../../../../lib/server/routeGuards";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ artifactId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { artifactId } = await context.params;
  const session = await requireSession(request);
  if (session instanceof NextResponse) {
    return session;
  }
  const boundary = requireBoundary(session, "read_quote_artifact");
  if (boundary) {
    return boundary;
  }
  try {
    const artifact = await getQuoteArtifact(session.mutationScope, artifactId);
    return NextResponse.json({ artifact });
  } catch {
    return safeError(404, "Not found", "The requested tenant-scoped quote artifact was not found.");
  }
}
