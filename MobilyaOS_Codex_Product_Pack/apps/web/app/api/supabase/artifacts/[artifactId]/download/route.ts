import { NextResponse } from "next/server";
import { getQuoteArtifactDownload } from "../../../../../../lib/server/supabaseRepository";
import { requireBoundary, requireSession, safeError } from "../../../../../../lib/server/routeGuards";

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
    const artifact = await getQuoteArtifactDownload(session.mutationScope, artifactId);
    const bodyBuffer = new ArrayBuffer(artifact.bytes.byteLength);
    new Uint8Array(bodyBuffer).set(artifact.bytes);
    const filename = artifact.artifact_type === "quote_pdf"
      ? "mobilyaos-quote-artifact.pdf"
      : "mobilyaos-quote-artifact.html";
    return new NextResponse(new Blob([bodyBuffer], { type: artifact.content_type }), {
      status: 200,
      headers: {
        "Content-Type": artifact.content_type,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'; sandbox"
      }
    });
  } catch {
    return safeError(404, "Not found", "The requested tenant-scoped quote artifact was not found.");
  }
}
