import { NextResponse } from "next/server";
import { appendAuditEntry, createCustomer, listCustomers } from "../../../../lib/server/supabaseRepository";
import { withMutationSession, withReadSession } from "../../../../lib/server/routeGuards";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return withReadSession(request, async ({ session }) => {
    const customers = await listCustomers(session.mutationScope);
    return NextResponse.json({ customers });
  });
}

export async function POST(request: Request) {
  return withMutationSession(
    request,
    "create_customer",
    "customer_created",
    async ({ session }, body, reservation) => {
      const customer = await createCustomer(session.mutationScope, {
        name: typeof body.name === "string" ? body.name : "",
        email: typeof body.email === "string" ? body.email : null,
        phone: typeof body.phone === "string" ? body.phone : null
      });
      await appendAuditEntry(session.mutationScope, {
        action: "customer_created",
        target_type: "customer",
        target_id: customer.id,
        metadata: {
          route: "customers",
          idempotency: Boolean(reservation),
          idempotency_mode: "durable_supabase_scoped"
        }
      });
      return NextResponse.json({ customer }, { status: 201 });
    },
    { resource: { type: "customer_collection", id: "customers", version: "customer-create-v1.0.0" } }
  );
}
