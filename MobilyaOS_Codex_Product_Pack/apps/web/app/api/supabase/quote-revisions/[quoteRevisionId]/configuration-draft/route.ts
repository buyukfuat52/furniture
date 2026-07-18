import { NextResponse } from "next/server";
import {
  appendAuditEntry,
  createQuoteConfigurationDraft,
  getQuoteConfigurationDraft,
  updateQuoteConfigurationDraft
} from "../../../../../../lib/server/supabaseRepository";
import { withMutationSession, withReadSession } from "../../../../../../lib/server/routeGuards";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ quoteRevisionId: string }>;
};

const deferredActions = ["bom_calculation", "cost_snapshot", "quote_send", "quote_approve", "quote_pdf", "production_package"];

export async function GET(request: Request, context: RouteContext) {
  const { quoteRevisionId } = await context.params;
  return withReadSession(request, async ({ session }) => {
    const configuration_draft = await getQuoteConfigurationDraft(session.mutationScope, quoteRevisionId);
    return NextResponse.json({
      configuration_draft,
      calculation_status: "not_calculated",
      deferred_actions: deferredActions
    });
  });
}

export async function POST(request: Request, context: RouteContext) {
  const { quoteRevisionId } = await context.params;
  return withMutationSession(request, "create_quote_configuration_draft", "quote_configuration_created", async ({ session }, body, reservation) => {
    const configuration_draft = await createQuoteConfigurationDraft(session.mutationScope, quoteRevisionId, body);
    await appendAuditEntry(session.mutationScope, {
      action: "quote_configuration_created",
      target_type: "quote_configuration_draft",
      target_id: configuration_draft.id,
      metadata: {
        route: "quote_configuration_drafts",
        revision_id: configuration_draft.quote_revision_id,
        idempotency: Boolean(reservation),
        idempotency_mode: "durable_supabase_scoped",
        calculated: false
      }
    });
    return NextResponse.json(
      {
        configuration_draft,
        calculation_status: "not_calculated",
        deferred_actions: deferredActions
      },
      { status: 201 }
    );
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { quoteRevisionId } = await context.params;
  return withMutationSession(request, "update_quote_configuration_draft", "quote_configuration_updated", async ({ session }, body, reservation) => {
    const configuration_draft = await updateQuoteConfigurationDraft(session.mutationScope, quoteRevisionId, body);
    await appendAuditEntry(session.mutationScope, {
      action: "quote_configuration_updated",
      target_type: "quote_configuration_draft",
      target_id: configuration_draft.id,
      metadata: {
        route: "quote_configuration_drafts",
        revision_id: configuration_draft.quote_revision_id,
        idempotency: Boolean(reservation),
        idempotency_mode: "durable_supabase_scoped",
        calculated: false
      }
    });
    return NextResponse.json({
      configuration_draft,
      calculation_status: "not_calculated",
      deferred_actions: deferredActions
    });
  });
}
