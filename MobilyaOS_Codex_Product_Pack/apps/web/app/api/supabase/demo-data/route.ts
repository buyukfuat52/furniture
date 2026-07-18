import { NextResponse } from "next/server";
import { resolveAuthenticatedSession } from "../../../../lib/server/sessionContext";
import { loadDemoTenantOverview } from "../../../../lib/server/supabaseRepository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  let session: Awaited<ReturnType<typeof resolveAuthenticatedSession>>;
  try {
    session = await resolveAuthenticatedSession(request);
  } catch {
    session = null;
  }
  if (!session) {
    return NextResponse.json(
      { title: "Authentication required", detail: "A valid demo session is required." },
      { status: 401 }
    );
  }
  try {
    const overview = await loadDemoTenantOverview(session.claims.company_id);
    return NextResponse.json(overview);
  } catch {
    return NextResponse.json(
      { title: "Supabase demo data unavailable", detail: "Server-side Supabase read failed." },
      { status: 503 }
    );
  }
}
