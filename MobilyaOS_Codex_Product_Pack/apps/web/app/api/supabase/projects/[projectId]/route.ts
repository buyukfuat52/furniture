import { NextResponse } from "next/server";
import { getProjectDetail } from "../../../../../lib/server/supabaseRepository";
import { withReadSession } from "../../../../../lib/server/routeGuards";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  return withReadSession(request, async ({ session }) => {
    const detail = await getProjectDetail(session.mutationScope, projectId);
    return NextResponse.json(detail);
  });
}
