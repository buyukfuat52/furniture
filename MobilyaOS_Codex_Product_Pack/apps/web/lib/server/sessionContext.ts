import { loadAppUserContext, toPublicMappedAppUser } from "./supabaseRepository";
import { sessionFromRequest, type SessionClaims } from "./session";

export type PublicSession = {
  authenticated: true;
  app_user: {
    email: string;
    role: string;
  };
  company: {
    name: string;
    currency: string;
  };
  expires_at: string;
};

export type ResolvedSession = {
  claims: SessionClaims;
  mutationScope: {
    appUserId: string;
    companyId: string;
    role: string;
  };
  publicSession: PublicSession;
};

export async function resolveAuthenticatedSession(request: Request): Promise<ResolvedSession | null> {
  const claims = sessionFromRequest(request);
  if (!claims) {
    return null;
  }
  const mapped = await loadAppUserContext(claims.app_user_id, claims.company_id);
  return {
    claims,
    mutationScope: {
      appUserId: claims.app_user_id,
      companyId: claims.company_id,
      role: mapped.app_user.role
    },
    publicSession: {
      authenticated: true,
      ...toPublicMappedAppUser(mapped),
      expires_at: new Date(claims.expires_at * 1000).toISOString()
    }
  };
}
