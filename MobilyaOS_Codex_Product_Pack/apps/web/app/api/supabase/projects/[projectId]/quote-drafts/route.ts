import { NextResponse } from "next/server";
import { appendAuditEntry, createQuoteDraft } from "../../../../../../lib/server/supabaseRepository";
import { withMutationSession } from "../../../../../../lib/server/routeGuards";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  return withMutationSession(request, "create_quote_revision_draft", "quote_draft_created", async ({ session }, _body, reservation) => {
    const quote_revision = await createQuoteDraft(session.mutationScope, { project_id: projectId });
    await appendAuditEntry(session.mutationScope, {
      action: "quote_draft_created",
      target_type: "quote_revision",
      target_id: quote_revision.id,
      metadata: {
        route: "quote_drafts",
        idempotency: Boolean(reservation),
        idempotency_mode: "in_memory_scoped",
        calculated: false
      }
    });
    return NextResponse.json(
      {
        quote_revision,
        calculation_status: "not_calculated",
        deferred_actions: ["quote_send", "quote_approve", "quote_pdf", "production_package"]
      },
      { status: 201 }
    );
  });
}
