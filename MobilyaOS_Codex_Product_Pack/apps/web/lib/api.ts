export type HealthResponse = {
  status: "ok";
  service: string;
  version: string;
};

export type ProjectSummary = {
  id: string;
  company_id: string;
  customer_name: string;
  name: string;
  status: "draft" | "active" | "archived";
  version: number;
};

export type ApiError = {
  title?: string;
  detail?: string;
};

export type MoneyMinor = {
  amount_minor: number;
  currency: string;
};

export type Customer = {
  id: string;
  company_id: string;
  name: string;
  email?: string;
  phone?: string;
  version: number;
};

export type BOMPart = {
  code: string;
  name: string;
  width_mm: number;
  height_mm: number;
  quantity: number;
};

export type EdgeRequirement = {
  part_code: string;
  edge: string;
  billable_mm: number;
};

export type LaborLine = {
  code: string;
  name: string;
  total_cost: MoneyMinor;
};

export type CostCategory = {
  category: string;
  amount: MoneyMinor;
};

export type QuoteRevision = {
  id: string;
  parent_revision_id?: string;
  revision_number: number;
  bom: BOMPart[];
  edges: EdgeRequirement[];
  labor: LaborLine[];
  cost: {
    categories: CostCategory[];
    subtotal: MoneyMinor;
    markup: MoneyMinor;
    vat: MoneyMinor;
    grand_total: MoneyMinor;
  };
};

export type QuoteDocument = {
  id: string;
  revision_id: string;
  content_type: string;
  sha256: string;
  html: string;
};

export type DiffResponse = {
  left_revision_id: string;
  right_revision_id: string;
  entries: Array<{
    category: string;
    field: string;
    before: string;
    after: string;
  }>;
};

export type AgentChatResponse = {
  agent_id: "enterprise_search" | "costing_pricing" | "revision_diff" | "quote_document";
  classification: string;
  mode: "rules";
  tool_calls: Array<{
    id: string;
    tool: string;
    action: string;
    status: "completed" | "denied" | "approval_required";
    approval_required: boolean;
    summary: string;
  }>;
  response: {
    status: "completed" | "needs_input" | "needs_approval" | "failed" | "informational";
    summary: string;
    facts: Array<{ label: string; value: unknown }>;
    proposed_actions: Array<{
      action: string;
      description: string;
      risk: string;
      approval_required: boolean;
    }>;
    approval: { required: boolean; state: string; approval_id?: string | null };
    warnings: string[];
    missing_information: string[];
  };
};

export type SupabaseDemoOverview = {
  source: "supabase";
  company: { name: string; currency: string };
  app_users: Array<{ email: string; role: string }>;
  customers: Array<{ id: string; name: string; email: string | null; phone: string | null; version: number }>;
  projects: Array<{
    id: string;
    customer_id: string | null;
    customer_name: string;
    name: string;
    status: string;
    version: number;
  }>;
  quote_revisions: Array<{ id: string; project_id: string; revision_number: number; status: string; version: number }>;
  bom_snapshots: Array<{ id: string; revision_id: string; formula_version: string; part_count: number; edge_count: number }>;
  cost_snapshots: Array<{
    id: string;
    revision_id: string;
    formula_version: string;
    currency: string;
    subtotal_minor: number;
    markup_minor: number;
    vat_minor: number;
    grand_total_minor: number;
    category_count: number;
  }>;
  generated_documents: Array<{
    id: string;
    revision_id: string;
    cost_snapshot_id: string | null;
    document_type: string;
    storage_bucket: string;
    content_type: string;
    size_bytes: number;
  }>;
  approvals: Array<{ id: string; revision_id: string; action: string; status: string }>;
  audit_entries: Array<{
    id: string;
    action: string;
    target_type: string;
    decision: string;
    created_at: string;
  }>;
  limitations: string[];
};

export type SupabaseDemoLoginResponse = {
  authenticated: boolean;
  session_persisted: boolean;
  app_user: { email: string; role: string };
  company: { name: string; currency: string };
  expires_at: string;
};

export type SupabaseSessionResponse = {
  authenticated: true;
  app_user: { email: string; role: string };
  company: { name: string; currency: string };
  expires_at: string;
};

export type SupabaseLogoutResponse = {
  authenticated: false;
  session_cleared: boolean;
};

export const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";
export const computeBaseUrl = process.env.NEXT_PUBLIC_COMPUTE_BASE_URL ?? "http://localhost:8090";
