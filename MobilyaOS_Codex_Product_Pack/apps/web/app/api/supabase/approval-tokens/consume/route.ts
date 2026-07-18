import { NextResponse } from "next/server";
import { requireApprovalTokenConsumeRateLimit, requireSameOriginMutation } from "../../../../../lib/server/requestSecurity";
import { consumeApprovalToken } from "../../../../../lib/server/supabaseRepository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const allowedBodyKeys = new Set(["approval_token"]);

function approvalTokenFromBody(body: Record<string, unknown>): string {
  const unsupported = Object.keys(body).filter((key) => !allowedBodyKeys.has(key));
  if (unsupported.length) {
    throw new Error("approval token request contains unsupported fields.");
  }
  const tokenValue = body["approval_token"];
  if (typeof tokenValue !== "string") {
    throw new Error("approval token is required.");
  }
  const token = tokenValue.trim();
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(token)) {
    throw new Error("approval token is invalid.");
  }
  return token;
}

function invalidTokenResponse(status = 404): NextResponse {
  return NextResponse.json(
    {
      title: "Approval token rejected",
      detail: "The approval token cannot be consumed.",
      approval_consumption: {
        status: "invalid",
        consumed: false,
        token_secret_returned: false,
        quote_status_changed: false,
        quote_send_triggered: false,
        production_package_triggered: false,
        deferred_actions: ["quote_send", "quote_approve", "production_package"]
      }
    },
    { status }
  );
}

export async function POST(request: Request) {
  const sameOrigin = requireSameOriginMutation(request);
  if (sameOrigin) {
    return sameOrigin;
  }

  let token: string;
  try {
    const parsed = (await request.json()) as unknown;
    const body = typeof parsed === "object" && parsed !== null ? parsed as Record<string, unknown> : {};
    token = approvalTokenFromBody(body);
  } catch {
    return invalidTokenResponse(422);
  }

  const rateLimit = requireApprovalTokenConsumeRateLimit(token);
  if (rateLimit) {
    return rateLimit;
  }

  try {
    const approval_consumption = await consumeApprovalToken(token);
    const status = approval_consumption.consumed ? 200 : 409;
    return NextResponse.json({ approval_consumption }, { status });
  } catch {
    return invalidTokenResponse();
  }
}
