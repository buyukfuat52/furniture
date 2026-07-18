import { createCipheriv, createDecipheriv, createHash, createSecretKey, randomBytes } from "node:crypto";
import { loadSessionKeyMaterial } from "./supabaseEnv";

export const SESSION_COOKIE_NAME = "mobilyaos_demo_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 8;

const sessionVersion = 1;
const aad = asByteView(Buffer.from("mobilyaos.demo.session.v1", "utf8"));

export type SessionClaims = {
  version: number;
  app_user_id: string;
  email: string;
  role: string;
  company_id: string;
  company_name: string;
  currency: string;
  issued_at: number;
  expires_at: number;
};

export type SessionCookieOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
};

function base64UrlEncode(value: Buffer): string {
  return value.toString("base64url");
}

function base64UrlDecode(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

function asByteView(buffer: Buffer): Uint8Array {
  return Uint8Array.from(buffer);
}

function encryptionKey(): ReturnType<typeof createSecretKey> {
  return createSecretKey(asByteView(createHash("sha256").update(loadSessionKeyMaterial(), "utf8").digest()));
}

function parseCookieHeader(cookieHeader: string | null): Map<string, string> {
  const cookies = new Map<string, string>();
  if (!cookieHeader) {
    return cookies;
  }
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator <= 0) {
      continue;
    }
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (name) {
      cookies.set(name, value);
    }
  }
  return cookies;
}

function isClaims(value: unknown): value is SessionClaims {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const claims = value as Partial<SessionClaims>;
  return (
    claims.version === sessionVersion &&
    typeof claims.app_user_id === "string" &&
    typeof claims.email === "string" &&
    typeof claims.role === "string" &&
    typeof claims.company_id === "string" &&
    typeof claims.company_name === "string" &&
    typeof claims.currency === "string" &&
    typeof claims.issued_at === "number" &&
    typeof claims.expires_at === "number"
  );
}

export function sessionCookieOptions(): SessionCookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS
  };
}

export function createSessionClaims(input: {
  appUserId: string;
  email: string;
  role: string;
  companyId: string;
  companyName: string;
  currency: string;
}): SessionClaims {
  const issuedAt = Math.floor(Date.now() / 1000);
  return {
    version: sessionVersion,
    app_user_id: input.appUserId,
    email: input.email,
    role: input.role,
    company_id: input.companyId,
    company_name: input.companyName,
    currency: input.currency,
    issued_at: issuedAt,
    expires_at: issuedAt + SESSION_TTL_SECONDS
  };
}

export function sealSession(claims: SessionClaims): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), asByteView(iv));
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(claims), "utf8"),
    cipher.final()
  ] as unknown as readonly Uint8Array[]);
  const tag = cipher.getAuthTag();
  return [
    "v1",
    base64UrlEncode(iv),
    base64UrlEncode(ciphertext),
    base64UrlEncode(tag)
  ].join(".");
}

export function openSession(sealed: string): SessionClaims | null {
  const [version, ivText, ciphertextText, tagText] = sealed.split(".");
  if (version !== "v1" || !ivText || !ciphertextText || !tagText) {
    return null;
  }
  try {
    const iv = base64UrlDecode(ivText);
    const ciphertext = base64UrlDecode(ciphertextText);
    const tag = base64UrlDecode(tagText);
    if (iv.length !== 12) {
      return null;
    }
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), asByteView(iv));
    decipher.setAAD(aad);
    decipher.setAuthTag(asByteView(tag));
    const plaintext = Buffer.concat([
      decipher.update(asByteView(ciphertext)),
      decipher.final()
    ] as unknown as readonly Uint8Array[]).toString("utf8");
    const parsed = JSON.parse(plaintext) as unknown;
    if (!isClaims(parsed)) {
      return null;
    }
    if (parsed.expires_at <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function sessionFromRequest(request: Request): SessionClaims | null {
  const cookieValue = parseCookieHeader(request.headers.get("cookie")).get(SESSION_COOKIE_NAME);
  return cookieValue ? openSession(cookieValue) : null;
}
