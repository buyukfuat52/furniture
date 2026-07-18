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
  quote_revisions: Array<{
    id: string;
    project_id: string;
    parent_revision_id: string | null;
    product_variant_id: string | null;
    revision_number: number;
    status: string;
    version: number;
  }>;
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
    content_type: string;
    document_version: string;
    revision_version: number;
    snapshot_hash: string | null;
    calculation_version: string | null;
    sha256: string;
    size_bytes: number;
  }>;
  approvals: Array<{ id: string; revision_id: string; action: string; status: string }>;
  audit_entries: Array<{
    id: string;
    action: string;
    target_type: string;
    target_id: string | null;
    decision: string;
    created_at: string;
  }>;
  limitations: string[];
};

export type SupabaseAuditEntry = SupabaseDemoOverview["audit_entries"][number];
export type SupabaseProject = SupabaseDemoOverview["projects"][number];
export type SupabaseQuoteRevision = SupabaseDemoOverview["quote_revisions"][number];

export type SupabaseQuoteDocument = {
  id: string;
  revision_id: string;
  cost_snapshot_id: string | null;
  document_type: string;
  content_type: string;
  document_version: string;
  revision_version: number;
  snapshot_hash: string | null;
  calculation_version: string | null;
  sha256: string;
  size_bytes: number;
  created_at: string;
  provenance: {
    source: "deterministic_server_document";
    document_version: string;
    quote_revision_id: string;
    quote_revision_version: number;
    cost_snapshot_id: string | null;
    cost_snapshot_hash: string | null;
    bom_snapshot_hash: string | null;
    calculation_version: string | null;
    storage: "server_route_mediated";
    pdf_status: "deferred";
  };
};

export type SupabaseQuoteDocumentPreview = SupabaseQuoteDocument & {
  html: string;
};

export type SupabaseQuoteForkResponse = {
  quote_revision: SupabaseQuoteRevision;
  configuration_draft: SupabaseQuoteConfigurationDraft | null;
  snapshot_copy_policy: "snapshots_not_copied";
  document_copy_policy: "documents_not_copied";
  deferred_actions: string[];
};

export type SupabaseQuoteRevisionDiff = {
  left_revision: SupabaseQuoteRevision;
  right_revision: SupabaseQuoteRevision;
  entries: Array<{
    category: string;
    field: string;
    before: string;
    after: string;
  }>;
  diff_version: "revision-diff-v1.0.0";
  source: "deterministic_server_diff";
};

export type SupabaseApprovalGate = {
  id: string | null;
  revision_id: string;
  action: "quote_approve";
  status: "not_prepared" | "pending" | "approved" | "rejected" | "consumed" | "expired";
  token_secret_returned: false;
  approval_token_version: string | null;
  quote_revision_version: number | null;
  generated_document_id: string | null;
  document_hash: string | null;
  snapshot_hash: string | null;
  expires_at: string | null;
  deferred_actions: string[];
};

export type SupabaseQuoteStatusPolicy = {
  status: string;
  mutable: boolean;
  direct_status_update_allowed: false;
  allowed_transitions: string[];
  deferred_actions: string[];
  blocked_actions: string[];
};

export type SupabaseProjectDetail = {
  project: SupabaseProject;
  quote_revisions: SupabaseQuoteRevision[];
  audit_entries: SupabaseAuditEntry[];
};

export type SupabaseQuoteRevisionDetail = {
  quote_revision: SupabaseQuoteRevision;
  status_policy: SupabaseQuoteStatusPolicy;
  audit_entries: SupabaseAuditEntry[];
};

export type SupabaseQuoteConfigurationDraft = {
  id: string;
  quote_revision_id: string;
  configuration: {
    template_code: string;
    width_mm: number;
    height_mm: number;
    depth_mm: number;
    quantity: number;
    door_count: number;
    shelf_count: number;
    material_sku: string | null;
    edge_band_sku: string | null;
    notes: string | null;
  };
  validation_status: "draft_validated";
  calculation_status: "not_calculated";
  version: number;
  updated_at: string;
};

export type SupabaseQuoteConfigurationDraftResponse = {
  configuration_draft: SupabaseQuoteConfigurationDraft | null;
  calculation_status: "not_calculated";
  deferred_actions: string[];
};

export type SupabaseQuoteSnapshotResponse = {
  calculation_status: "not_calculated" | "calculated";
  quote_revision: SupabaseQuoteRevision;
  configuration_draft: SupabaseQuoteConfigurationDraft | null;
  bom_snapshot: null | {
    id: string;
    revision_id: string;
    formula_version: string;
    parts: Array<{
      code: string;
      name: string;
      material_sku: string;
      width_mm: number;
      height_mm: number;
      quantity: number;
      area_mm2: number;
    }>;
    edges: Array<{
      part_code: string;
      edge: "north" | "east" | "south" | "west";
      visibility: string;
      band_sku: string;
      process: string;
      length_mm: number;
      part_quantity: number;
      base_length_mm: number;
      waste_bps: number;
      setup_mm: number;
      billable_mm: number;
    }>;
    part_count: number;
    edge_count: number;
    snapshot_hash: string;
  };
  cost_snapshot: null | {
    id: string;
    revision_id: string;
    formula_version: string;
    currency: string;
    subtotal_minor: number;
    markup_minor: number;
    vat_minor: number;
    grand_total_minor: number;
    categories: Array<{ category: string; amount_minor: number; currency: string }>;
    labor: Array<{
      code: string;
      name: string;
      labor_type: "unit" | "setup";
      unit_labor_minor: number;
      quantity: number;
      total_minor: number;
      currency: string;
    }>;
    quote_total: {
      pricing_method: "markup";
      markup_bps: number;
      vat_bps: number;
      subtotal_minor: number;
      markup_minor: number;
      vat_minor: number;
      grand_total_minor: number;
      currency: string;
    };
    provenance: {
      calculation_version: string;
      source: "deterministic_service";
      input_schema_version: "quote_configuration_draft_v1";
      configuration_draft_id: string;
      configuration_version: number;
      quote_revision_id: string;
      bom_snapshot_hash: string;
      price_sources: Array<{
        sku: string;
        unit: string;
        price_minor: number;
        currency: string;
        source: string;
        source_ref: string;
      }>;
      limitations: string[];
      labor?: Array<{
        code: string;
        name: string;
        labor_type: "unit" | "setup";
        unit_labor_minor: number;
        quantity: number;
        total_minor: number;
        currency: string;
      }>;
    };
    snapshot_hash: string;
  };
  deferred_actions: string[];
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
