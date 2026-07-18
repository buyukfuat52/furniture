import { NextResponse } from "next/server";
import { requireSameOriginMutation } from "../../../../lib/server/requestSecurity";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "../../../../lib/server/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestSafety = requireSameOriginMutation(request);
  if (requestSafety) {
    return requestSafety;
  }
  const response = NextResponse.json({ authenticated: false, session_cleared: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    ...sessionCookieOptions(),
    maxAge: 0
  });
  return response;
}
