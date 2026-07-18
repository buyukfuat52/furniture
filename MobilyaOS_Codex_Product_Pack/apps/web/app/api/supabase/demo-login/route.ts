import { NextResponse } from "next/server";
import { createSessionClaims, sealSession, SESSION_COOKIE_NAME, sessionCookieOptions } from "../../../../lib/server/session";
import { signInAndMapDemoUser, toPublicMappedAppUser } from "../../../../lib/server/supabaseRepository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { email?: unknown; password?: unknown };
    const email = typeof payload.email === "string" ? payload.email : "";
    const password = typeof payload.password === "string" ? payload.password : "";
    const mapped = await signInAndMapDemoUser(email, password);
    const claims = createSessionClaims({
      appUserId: mapped.app_user.id,
      email: mapped.app_user.email,
      role: mapped.app_user.role,
      companyId: mapped.company.id,
      companyName: mapped.company.name,
      currency: mapped.company.currency
    });
    const response = NextResponse.json({
      authenticated: true,
      session_persisted: true,
      ...toPublicMappedAppUser(mapped),
      expires_at: new Date(claims.expires_at * 1000).toISOString()
    });
    response.cookies.set(SESSION_COOKIE_NAME, sealSession(claims), sessionCookieOptions());
    return response;
  } catch {
    return NextResponse.json(
      { authenticated: false, title: "Supabase demo login failed", detail: "Demo user could not be mapped." },
      { status: 401 }
    );
  }
}
