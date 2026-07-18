import { NextResponse } from "next/server";
import { appendAuditEntry, createProject, listProjects } from "../../../../lib/server/supabaseRepository";
import { withMutationSession, withReadSession } from "../../../../lib/server/routeGuards";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return withReadSession(request, async ({ session }) => {
    const projects = await listProjects(session.mutationScope);
    return NextResponse.json({ projects });
  });
}

export async function POST(request: Request) {
  return withMutationSession(request, "create_project", "project_created", async ({ session }, body, reservation) => {
    const project = await createProject(session.mutationScope, {
      customer_id: typeof body.customer_id === "string" ? body.customer_id : "",
      name: typeof body.name === "string" ? body.name : ""
    });
    await appendAuditEntry(session.mutationScope, {
      action: "project_created",
      target_type: "project",
      target_id: project.id,
      metadata: {
        route: "projects",
        idempotency: Boolean(reservation),
        idempotency_mode: "durable_supabase_scoped"
      }
    });
    return NextResponse.json({ project }, { status: 201 });
  });
}
