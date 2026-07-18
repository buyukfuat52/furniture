import { NextResponse } from "next/server";
import { resolveAuthenticatedSession } from "../../../../lib/server/sessionContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const session = await resolveAuthenticatedSession(request);
    if (!session) {
      return NextResponse.json(
        { authenticated: false, title: "Authentication required", detail: "A valid demo session is required." },
        { status: 401 }
      );
    }
    return NextResponse.json(session.publicSession);
  } catch {
    return NextResponse.json(
      { authenticated: false, title: "Authentication required", detail: "A valid demo session is required." },
      { status: 401 }
    );
  }
}
