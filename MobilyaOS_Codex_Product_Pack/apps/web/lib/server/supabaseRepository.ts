import { loadSupabaseServerEnv } from "./supabaseEnv";

type JsonRecord = Record<string, unknown>;

export type CompanyRecord = {
  id: string;
  name: string;
  currency: string;
};

export type PublicCompanyRecord = {
  name: string;
  currency: string;
};

export type AppUserRecord = {
  id: string;
  email: string;
  role: string;
};

export type PublicAppUserRecord = {
  email: string;
  role: string;
};

export type CustomerRecord = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  version: number;
};

export type CustomerInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
};

export type ProjectRecord = {
  id: string;
  customer_id: string | null;
  customer_name: string;
  name: string;
  status: string;
  version: number;
};

export type ProjectInput = {
  customer_id: string;
  name: string;
};

export type QuoteRevisionRecord = {
  id: string;
  project_id: string;
  revision_number: number;
  status: string;
  version: number;
};

export type QuoteDraftInput = {
  project_id: string;
};

export type BomSnapshotRecord = {
  id: string;
  revision_id: string;
  formula_version: string;
  part_count: number;
  edge_count: number;
};

export type CostSnapshotRecord = {
  id: string;
  revision_id: string;
  formula_version: string;
  currency: string;
  subtotal_minor: number;
  markup_minor: number;
  vat_minor: number;
  grand_total_minor: number;
  category_count: number;
};

export type GeneratedDocumentRecord = {
  id: string;
  revision_id: string;
  cost_snapshot_id: string | null;
  document_type: string;
  storage_bucket: string;
  content_type: string;
  size_bytes: number;
};

export type ApprovalRecord = {
  id: string;
  revision_id: string;
  action: string;
  status: string;
};

export type AuditEntryRecord = {
  id: string;
  action: string;
  target_type: string;
  decision: string;
  created_at: string;
};

export type DemoTenantOverview = {
  source: "supabase";
  company: PublicCompanyRecord;
  app_users: PublicAppUserRecord[];
  customers: CustomerRecord[];
  projects: ProjectRecord[];
  quote_revisions: QuoteRevisionRecord[];
  bom_snapshots: BomSnapshotRecord[];
  cost_snapshots: CostSnapshotRecord[];
  generated_documents: GeneratedDocumentRecord[];
  approvals: ApprovalRecord[];
  audit_entries: AuditEntryRecord[];
  limitations: string[];
};

export type MappedAppUser = {
  app_user: AppUserRecord;
  company: CompanyRecord;
};

export type TrustedRepositoryContext = {
  appUserId: string;
  companyId: string;
  role: string;
};

export type PublicMappedAppUser = {
  app_user: PublicAppUserRecord;
  company: PublicCompanyRecord;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function cleanText(value: string, maxLength: number): string {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function cleanNullableText(value: string | null | undefined, maxLength: number): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const cleaned = cleanText(value, maxLength);
  return cleaned || null;
}

function requireUuid(value: string, label: string): string {
  const cleaned = value.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleaned)) {
    throw new Error(`${label} is invalid.`);
  }
  return cleaned;
}

function requireName(value: string, label: string): string {
  const cleaned = cleanText(value, 140);
  if (cleaned.length < 2) {
    throw new Error(`${label} is required.`);
  }
  return cleaned;
}

function companyFromRow(row: JsonRecord): CompanyRecord {
  return {
    id: asString(row.id),
    name: asString(row.name),
    currency: asString(row.currency)
  };
}

function publicCompanyFromRecord(company: CompanyRecord): PublicCompanyRecord {
  return {
    name: company.name,
    currency: company.currency
  };
}

function appUserFromRow(row: JsonRecord): AppUserRecord {
  return {
    id: asString(row.id),
    email: asString(row.email),
    role: asString(row.role)
  };
}

function publicAppUserFromRecord(appUser: AppUserRecord): PublicAppUserRecord {
  return {
    email: appUser.email,
    role: appUser.role
  };
}

function assertCompanyScope(rows: JsonRecord[], companyId: string, label: string): void {
  const hasForeignRow = rows.some((row) => row.company_id !== companyId);
  if (hasForeignRow) {
    throw new Error(`${label} query returned an out-of-scope company row.`);
  }
}

async function supabaseRest<T extends JsonRecord[]>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const env = loadSupabaseServerEnv();
  const response = await fetch(`${env.supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: env.supabaseSecretKey,
      Authorization: `Bearer ${env.supabaseSecretKey}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`Supabase repository request failed with status ${response.status}.`);
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : []) as T;
}

async function supabaseRestObject<T extends JsonRecord>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const rows = await supabaseRest<JsonRecord[]>(path, init);
  if (rows.length !== 1) {
    throw new Error("Supabase repository expected exactly one row.");
  }
  return rows[0] as T;
}

async function supabaseAuth<T extends JsonRecord>(
  path: string,
  payload: JsonRecord
): Promise<T> {
  const env = loadSupabaseServerEnv();
  const response = await fetch(`${env.supabaseUrl}/auth/v1/${path}`, {
    method: "POST",
    headers: {
      apikey: env.supabasePublishableKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload),
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`Supabase auth request failed with status ${response.status}.`);
  }
  return (await response.json()) as T;
}

function tenantQuery(table: string, companyId: string, select: string, order?: string): string {
  const params = new URLSearchParams({
    company_id: `eq.${companyId}`,
    select
  });
  if (order) {
    params.set("order", order);
  }
  return `${table}?${params.toString()}`;
}

export async function loadDemoTenantOverview(
  companyId: string
): Promise<DemoTenantOverview> {
  const companies = await supabaseRest<JsonRecord[]>(
    `companies?${new URLSearchParams({ id: `eq.${companyId}`, select: "id,name,currency" }).toString()}`
  );
  if (companies.length !== 1) {
    throw new Error("Demo company was not found in Supabase.");
  }
  const company = companyFromRow(companies[0]);
  const [
    appUserRows,
    customerRows,
    projectRows,
    revisionRows,
    bomRows,
    costRows,
    documentRows,
    approvalRows,
    auditRows
  ] = await Promise.all([
    supabaseRest<JsonRecord[]>(tenantQuery("app_users", companyId, "id,company_id,email,role", "email.asc")),
    supabaseRest<JsonRecord[]>(tenantQuery("customers", companyId, "id,company_id,name,email,phone,version", "created_at.asc")),
    supabaseRest<JsonRecord[]>(tenantQuery("projects", companyId, "id,company_id,customer_id,name,status,version", "created_at.asc")),
    supabaseRest<JsonRecord[]>(tenantQuery("quote_revisions", companyId, "id,company_id,project_id,revision_number,status,version", "created_at.asc")),
    supabaseRest<JsonRecord[]>(tenantQuery("bom_snapshots", companyId, "id,company_id,revision_id,formula_version,bom_json,edge_json", "created_at.desc")),
    supabaseRest<JsonRecord[]>(tenantQuery("cost_snapshots", companyId, "id,company_id,revision_id,formula_version,currency,subtotal_minor,markup_minor,vat_minor,grand_total_minor,categories_json", "created_at.desc")),
    supabaseRest<JsonRecord[]>(tenantQuery("generated_documents", companyId, "id,company_id,revision_id,cost_snapshot_id,document_type,storage_bucket,content_type,size_bytes", "created_at.desc")),
    supabaseRest<JsonRecord[]>(tenantQuery("approvals", companyId, "id,company_id,revision_id,action,status", "created_at.desc")),
    supabaseRest<JsonRecord[]>(tenantQuery("audit_entries", companyId, "id,company_id,action,target_type,decision,created_at", "created_at.desc"))
  ]);
  const scopedRows = [
    ["app_users", appUserRows],
    ["customers", customerRows],
    ["projects", projectRows],
    ["quote_revisions", revisionRows],
    ["bom_snapshots", bomRows],
    ["cost_snapshots", costRows],
    ["generated_documents", documentRows],
    ["approvals", approvalRows],
    ["audit_entries", auditRows]
  ] as const;
  for (const [label, rows] of scopedRows) {
    assertCompanyScope(rows, companyId, label);
  }

  const customers = customerRows.map((row) => ({
    id: asString(row.id),
    name: asString(row.name),
    email: asNullableString(row.email),
    phone: asNullableString(row.phone),
    version: asNumber(row.version)
  }));
  const customerNames = new Map(customers.map((customer) => [customer.id, customer.name]));

  return {
    source: "supabase",
    company: publicCompanyFromRecord(company),
    app_users: appUserRows.map((row) => publicAppUserFromRecord(appUserFromRow(row))),
    customers,
    projects: projectRows.map((row) => ({
      id: asString(row.id),
      customer_id: asNullableString(row.customer_id),
      customer_name: customerNames.get(asString(row.customer_id)) ?? "",
      name: asString(row.name),
      status: asString(row.status),
      version: asNumber(row.version)
    })),
    quote_revisions: revisionRows.map((row) => ({
      id: asString(row.id),
      project_id: asString(row.project_id),
      revision_number: asNumber(row.revision_number),
      status: asString(row.status),
      version: asNumber(row.version)
    })),
    bom_snapshots: bomRows.map((row) => ({
      id: asString(row.id),
      revision_id: asString(row.revision_id),
      formula_version: asString(row.formula_version),
      part_count: asArray(row.bom_json).length,
      edge_count: asArray(row.edge_json).length
    })),
    cost_snapshots: costRows.map((row) => ({
      id: asString(row.id),
      revision_id: asString(row.revision_id),
      formula_version: asString(row.formula_version),
      currency: asString(row.currency),
      subtotal_minor: asNumber(row.subtotal_minor),
      markup_minor: asNumber(row.markup_minor),
      vat_minor: asNumber(row.vat_minor),
      grand_total_minor: asNumber(row.grand_total_minor),
      category_count: asArray(row.categories_json).length
    })),
    generated_documents: documentRows.map((row) => ({
      id: asString(row.id),
      revision_id: asString(row.revision_id),
      cost_snapshot_id: asNullableString(row.cost_snapshot_id),
      document_type: asString(row.document_type),
      storage_bucket: asString(row.storage_bucket),
      content_type: asString(row.content_type),
      size_bytes: asNumber(row.size_bytes)
    })),
    approvals: approvalRows.map((row) => ({
      id: asString(row.id),
      revision_id: asString(row.revision_id),
      action: asString(row.action),
      status: asString(row.status)
    })),
    audit_entries: auditRows.map((row) => ({
      id: asString(row.id),
      action: asString(row.action),
      target_type: asString(row.target_type),
      decision: asString(row.decision),
      created_at: asString(row.created_at)
    })),
    limitations: [
      "This page reads Supabase seeded snapshots. The P3 create/configure/fork flow still calls the Go core demo API.",
      "Supabase service access is server-side only; browser code receives sanitized tenant data."
    ]
  };
}

export async function listCustomers(context: TrustedRepositoryContext): Promise<CustomerRecord[]> {
  const rows = await supabaseRest<JsonRecord[]>(
    tenantQuery("customers", context.companyId, "id,company_id,name,email,phone,version", "created_at.desc")
  );
  assertCompanyScope(rows, context.companyId, "customers");
  return rows.map((row) => ({
    id: asString(row.id),
    name: asString(row.name),
    email: asNullableString(row.email),
    phone: asNullableString(row.phone),
    version: asNumber(row.version)
  }));
}

export async function createCustomer(
  context: TrustedRepositoryContext,
  input: CustomerInput
): Promise<CustomerRecord> {
  const body = {
    company_id: context.companyId,
    name: requireName(input.name, "Customer name"),
    email: cleanNullableText(input.email, 180),
    phone: cleanNullableText(input.phone, 60)
  };
  const row = await supabaseRestObject<JsonRecord>(
    "customers?select=id,company_id,name,email,phone,version",
    {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(body)
    }
  );
  assertCompanyScope([row], context.companyId, "customers");
  return {
    id: asString(row.id),
    name: asString(row.name),
    email: asNullableString(row.email),
    phone: asNullableString(row.phone),
    version: asNumber(row.version)
  };
}

export async function listProjects(context: TrustedRepositoryContext): Promise<ProjectRecord[]> {
  const rows = await supabaseRest<JsonRecord[]>(
    tenantQuery("projects", context.companyId, "id,company_id,customer_id,name,status,version", "created_at.desc")
  );
  assertCompanyScope(rows, context.companyId, "projects");
  const customers = await listCustomers(context);
  const customerNames = new Map(customers.map((customer) => [customer.id, customer.name]));
  return rows.map((row) => ({
    id: asString(row.id),
    customer_id: asNullableString(row.customer_id),
    customer_name: customerNames.get(asString(row.customer_id)) ?? "",
    name: asString(row.name),
    status: asString(row.status),
    version: asNumber(row.version)
  }));
}

export async function createProject(
  context: TrustedRepositoryContext,
  input: ProjectInput
): Promise<ProjectRecord> {
  const customerId = requireUuid(input.customer_id, "Customer id");
  const customers = await supabaseRest<JsonRecord[]>(
    `customers?${new URLSearchParams({
      id: `eq.${customerId}`,
      company_id: `eq.${context.companyId}`,
      select: "id,company_id,name"
    }).toString()}`
  );
  if (customers.length !== 1) {
    throw new Error("Customer was not found in the session company.");
  }
  assertCompanyScope(customers, context.companyId, "customers");
  const row = await supabaseRestObject<JsonRecord>(
    "projects?select=id,company_id,customer_id,name,status,version",
    {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        company_id: context.companyId,
        customer_id: customerId,
        name: requireName(input.name, "Project name"),
        status: "draft"
      })
    }
  );
  assertCompanyScope([row], context.companyId, "projects");
  return {
    id: asString(row.id),
    customer_id: asNullableString(row.customer_id),
    customer_name: asString(customers[0].name),
    name: asString(row.name),
    status: asString(row.status),
    version: asNumber(row.version)
  };
}

export async function listQuoteRevisions(
  context: TrustedRepositoryContext,
  projectId: string
): Promise<QuoteRevisionRecord[]> {
  const trustedProjectId = requireUuid(projectId, "Project id");
  await requireProjectInCompany(context, trustedProjectId);
  const rows = await supabaseRest<JsonRecord[]>(
    `quote_revisions?${new URLSearchParams({
      company_id: `eq.${context.companyId}`,
      project_id: `eq.${trustedProjectId}`,
      select: "id,company_id,project_id,revision_number,status,version",
      order: "revision_number.asc"
    }).toString()}`
  );
  assertCompanyScope(rows, context.companyId, "quote_revisions");
  return rows.map(quoteRevisionFromRow);
}

export async function getQuoteRevision(
  context: TrustedRepositoryContext,
  quoteRevisionId: string
): Promise<QuoteRevisionRecord> {
  const trustedRevisionId = requireUuid(quoteRevisionId, "Quote revision id");
  const rows = await supabaseRest<JsonRecord[]>(
    `quote_revisions?${new URLSearchParams({
      id: `eq.${trustedRevisionId}`,
      company_id: `eq.${context.companyId}`,
      select: "id,company_id,project_id,revision_number,status,version"
    }).toString()}`
  );
  if (rows.length !== 1) {
    throw new Error("Quote revision was not found in the session company.");
  }
  assertCompanyScope(rows, context.companyId, "quote_revisions");
  return quoteRevisionFromRow(rows[0]);
}

export async function createQuoteDraft(
  context: TrustedRepositoryContext,
  input: QuoteDraftInput
): Promise<QuoteRevisionRecord> {
  const projectId = requireUuid(input.project_id, "Project id");
  await requireProjectInCompany(context, projectId);
  const existingRows = await supabaseRest<JsonRecord[]>(
    `quote_revisions?${new URLSearchParams({
      company_id: `eq.${context.companyId}`,
      project_id: `eq.${projectId}`,
      select: "revision_number"
    }).toString()}`
  );
  const nextRevisionNumber = existingRows.reduce((max, row) => Math.max(max, asNumber(row.revision_number)), 0) + 1;
  const row = await supabaseRestObject<JsonRecord>(
    "quote_revisions?select=id,company_id,project_id,revision_number,status,version",
    {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        company_id: context.companyId,
        project_id: projectId,
        revision_number: nextRevisionNumber,
        status: "draft"
      })
    }
  );
  assertCompanyScope([row], context.companyId, "quote_revisions");
  return quoteRevisionFromRow(row);
}

export async function appendAuditEntry(
  context: TrustedRepositoryContext,
  input: {
    action: "customer_created" | "project_created" | "quote_draft_created";
    target_type: "customer" | "project" | "quote_revision";
    target_id: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await supabaseRest<JsonRecord[]>(
    "audit_entries?select=id",
    {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        company_id: context.companyId,
        actor_app_user_id: context.appUserId,
        action: input.action,
        target_type: input.target_type,
        target_id: requireUuid(input.target_id, "Audit target id"),
        decision: "allowed",
        metadata: sanitizeAuditMetadata(input.metadata ?? {})
      })
    }
  );
}

async function requireProjectInCompany(context: TrustedRepositoryContext, projectId: string): Promise<JsonRecord> {
  const rows = await supabaseRest<JsonRecord[]>(
    `projects?${new URLSearchParams({
      id: `eq.${projectId}`,
      company_id: `eq.${context.companyId}`,
      select: "id,company_id,customer_id,name"
    }).toString()}`
  );
  if (rows.length !== 1) {
    throw new Error("Project was not found in the session company.");
  }
  assertCompanyScope(rows, context.companyId, "projects");
  return rows[0];
}

function quoteRevisionFromRow(row: JsonRecord): QuoteRevisionRecord {
  return {
    id: asString(row.id),
    project_id: asString(row.project_id),
    revision_number: asNumber(row.revision_number),
    status: asString(row.status),
    version: asNumber(row.version)
  };
}

function sanitizeAuditMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const allowed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!/^[a-z0-9_]{1,40}$/i.test(key)) {
      continue;
    }
    if (typeof value === "string") {
      allowed[key] = cleanText(value, 160);
    } else if (typeof value === "number" || typeof value === "boolean" || value === null) {
      allowed[key] = value;
    }
  }
  return allowed;
}

export function toPublicMappedAppUser(mapped: MappedAppUser): PublicMappedAppUser {
  return {
    app_user: publicAppUserFromRecord(mapped.app_user),
    company: publicCompanyFromRecord(mapped.company)
  };
}

export async function loadAppUserContext(appUserId: string, companyId: string): Promise<MappedAppUser> {
  const rows = await supabaseRest<JsonRecord[]>(
    `app_users?${new URLSearchParams({
      id: `eq.${appUserId}`,
      company_id: `eq.${companyId}`,
      select: "id,company_id,email,role"
    }).toString()}`
  );
  if (rows.length !== 1) {
    throw new Error("Session app user is not mapped to the requested company.");
  }
  assertCompanyScope(rows, companyId, "app_users");
  const companyRows = await supabaseRest<JsonRecord[]>(
    `companies?${new URLSearchParams({
      id: `eq.${companyId}`,
      select: "id,name,currency"
    }).toString()}`
  );
  if (companyRows.length !== 1) {
    throw new Error("Session company was not found.");
  }
  return {
    app_user: appUserFromRow(rows[0]),
    company: companyFromRow(companyRows[0])
  };
}

export async function signInAndMapDemoUser(email: string, password: string): Promise<MappedAppUser> {
  const allowedDemoEmails = new Set(["admin@demo.local", "satis@demo.local", "viewer@demo.local"]);
  if (!allowedDemoEmails.has(email.toLowerCase())) {
    throw new Error("Only seeded demo users can be mapped in this development route.");
  }
  const authResponse = await supabaseAuth<JsonRecord>("token?grant_type=password", { email, password });
  const user = authResponse.user;
  const authUserId = typeof user === "object" && user !== null ? asString((user as JsonRecord).id) : "";
  if (!authUserId) {
    throw new Error("Supabase Auth did not return a mappable user.");
  }
  const rows = await supabaseRest<JsonRecord[]>(
    `app_users?${new URLSearchParams({
      auth_user_id: `eq.${authUserId}`,
      select: "id,company_id,email,role"
    }).toString()}`
  );
  if (rows.length !== 1) {
    throw new Error("Authenticated Supabase user is not mapped to exactly one app user.");
  }
  assertCompanyScope(rows, asString(rows[0].company_id), "app_users");
  const companyRows = await supabaseRest<JsonRecord[]>(
    `companies?${new URLSearchParams({
      id: `eq.${asString(rows[0].company_id)}`,
      select: "id,name,currency"
    }).toString()}`
  );
  if (companyRows.length !== 1) {
    throw new Error("Mapped company was not found.");
  }
  return {
    app_user: appUserFromRow(rows[0]),
    company: companyFromRow(companyRows[0])
  };
}
