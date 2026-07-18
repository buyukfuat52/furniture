import { NextResponse } from "next/server";
import { getQuoteRevisionDetail } from "../../../../../lib/server/supabaseRepository";
import { withReadSession } from "../../../../../lib/server/routeGuards";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ quoteRevisionId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { quoteRevisionId } = await context.params;
  return withReadSession(request, async ({ session }) => {
    const detail = await getQuoteRevisionDetail(session.mutationScope, quoteRevisionId);
    return NextResponse.json(detail);
  });
}
