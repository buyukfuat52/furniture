import { NextResponse } from "next/server";
import { safeError, withReadSession } from "../../../../lib/server/routeGuards";
import {
  getProjectDetail,
  getQuoteConfigurationDraft,
  getQuoteDocument,
  getQuoteRevisionDetail,
  getQuoteRevisionDiff,
  getQuoteSnapshot,
  listQuoteDocuments,
  listProjects,
  type AuditEntryRecord,
  type ProjectDetailRecord,
  type QuoteConfigurationDraftRecord,
  type QuoteDocumentRecord,
  type QuoteRevisionDetailRecord,
  type QuoteRevisionDiffResponse,
  type QuoteRevisionRecord,
  type QuoteSnapshotResponse
} from "../../../../lib/server/supabaseRepository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AgentId = "enterprise_search" | "costing_pricing" | "revision_diff" | "quote_document";
type ResponseStatus = "completed" | "needs_input" | "needs_approval" | "failed" | "informational";
type ToolStatus = "completed" | "denied" | "approval_required";

type SafeToolCall = {
  id: string;
  tool: string;
  action: string;
  status: ToolStatus;
  approval_required: boolean;
  summary: string;
};

type AgentResponseBody = {
  agent_id: AgentId;
  classification: string;
  mode: "rules";
  tool_calls: SafeToolCall[];
  response: {
    status: ResponseStatus;
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
    references: never[];
  };
};

type ChatPayload = {
  message?: unknown;
  document_id?: unknown;
  project_id?: unknown;
  quote_revision_id?: unknown;
  revision_id?: unknown;
  left_revision_id?: unknown;
  right_revision_id?: unknown;
};

const readOnlyGatewayMarker = "read_only_agent_gateway";
const promptInjectionBlockedMarker = "prompt_injection_blocked";
const mutationToolBlockedMarker = "mutation_tool_blocked";

function safeString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function searchText(message: string): string {
  return message
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0131/g, "i")
    .replace(/\u011f/g, "g")
    .replace(/\u015f/g, "s")
    .replace(/\u00e7/g, "c")
    .replace(/\u00f6/g, "o")
    .replace(/\u00fc/g, "u");
}

function classifyMessage(message: string): { agentId: AgentId; classification: string } {
  const normalized = searchText(message);
  if (/\b(diff|difference|revision|revizyon|fark|degisim)\b/u.test(normalized)) {
    return { agentId: "revision_diff", classification: "revision_diff_read_only" };
  }
  if (/\b(cost|pricing|maliyet|fiyat|toplam|snapshot|kenar|edge|labor|iscilik)\b/u.test(normalized)) {
    return { agentId: "costing_pricing", classification: "costing_pricing_explanation_read_only" };
  }
  if (/\b(quote|proposal|teklif|pdf|document|dokuman|onay|approve|send|gonder)\b/u.test(normalized)) {
    return { agentId: "quote_document", classification: "quote_document_read_only" };
  }
  return { agentId: "enterprise_search", classification: "enterprise_search_read_only" };
}

function looksLikePromptInjection(message: string): boolean {
  const normalized = searchText(message);
  return /ignore previous|system prompt|developer message|bypass|override|whitelist|policy|secret|token|password|service role|database url|cookie/i.test(normalized);
}

function asksForMutation(message: string): boolean {
  const normalized = searchText(message);
  return /send|gonder|approve|onayla|pdf|production|uretim|create|update|delete|sil|degistir|kaydet/i.test(normalized);
}

function responseBody(input: {
  agentId: AgentId;
  classification: string;
  status: ResponseStatus;
  summary: string;
  toolCalls?: SafeToolCall[];
  facts?: Array<{ label: string; value: unknown }>;
  proposedActions?: AgentResponseBody["response"]["proposed_actions"];
  warnings?: string[];
  missingInformation?: string[];
}): AgentResponseBody {
  return {
    agent_id: input.agentId,
    classification: input.classification,
    mode: "rules",
    tool_calls: input.toolCalls ?? [],
    response: {
      status: input.status,
      summary: input.summary,
      facts: input.facts ?? [],
      proposed_actions: input.proposedActions ?? [],
      approval: { required: false, state: "not_required", approval_id: null },
      warnings: input.warnings ?? [],
      missing_information: input.missingInformation ?? [],
      references: []
    }
  };
}

function completedTool(id: string, action: string, summary: string): SafeToolCall {
  return {
    id,
    tool: "supabase_read_only_agent_gateway",
    action,
    status: "completed",
    approval_required: false,
    summary
  };
}

function deniedTool(id: string, action: string, summary: string): SafeToolCall {
  return {
    id,
    tool: "supabase_read_only_agent_gateway",
    action,
    status: "denied",
    approval_required: false,
    summary
  };
}

function revisionLabel(revision: QuoteRevisionRecord): string {
  return `R${revision.revision_number} (${revision.status})`;
}

function latestAuditSummary(entries: AuditEntryRecord[]): string {
  const latest = entries[0];
  if (!latest) {
    return "kayit yok";
  }
  return `${latest.action} / ${latest.decision}`;
}

function projectFacts(detail: ProjectDetailRecord): Array<{ label: string; value: unknown }> {
  return [
    { label: "Proje", value: detail.project.name },
    { label: "Musteri", value: detail.project.customer_name || "atanmamis" },
    { label: "Proje durumu", value: detail.project.status },
    { label: "Revizyon sayisi", value: detail.quote_revisions.length },
    { label: "Revizyonlar", value: detail.quote_revisions.map(revisionLabel).join(", ") || "kayit yok" },
    { label: "Son audit", value: latestAuditSummary(detail.audit_entries) }
  ];
}

function revisionFacts(detail: QuoteRevisionDetailRecord): Array<{ label: string; value: unknown }> {
  return [
    { label: "Revizyon", value: revisionLabel(detail.quote_revision) },
    { label: "Revizyon degistirilebilir", value: detail.status_policy.mutable ? "evet" : "hayir" },
    { label: "Direkt durum guncelleme", value: detail.status_policy.direct_status_update_allowed ? "acik" : "kapali" },
    { label: "Bloke aksiyonlar", value: detail.status_policy.blocked_actions.join(", ") },
    { label: "Audit kaydi", value: `${detail.audit_entries.length} kayit` }
  ];
}

function configurationFacts(draft: QuoteConfigurationDraftRecord | null): Array<{ label: string; value: unknown }> {
  if (!draft) {
    return [
      { label: "Konfigurasyon taslagi", value: "yok" },
      { label: "Hesaplama durumu", value: "not_calculated" }
    ];
  }
  return [
    { label: "Konfigurasyon taslagi", value: `v${draft.version}` },
    { label: "Dogrulama durumu", value: draft.validation_status },
    { label: "Hesaplama durumu", value: draft.calculation_status },
    {
      label: "Olculer",
      value: `${draft.configuration.width_mm} x ${draft.configuration.height_mm} x ${draft.configuration.depth_mm} mm`
    },
    { label: "Adet", value: draft.configuration.quantity }
  ];
}

function snapshotFacts(snapshot: QuoteSnapshotResponse | null): Array<{ label: string; value: unknown }> {
  if (!snapshot || snapshot.calculation_status !== "calculated" || !snapshot.cost_snapshot || !snapshot.bom_snapshot) {
    return [
      { label: "Deterministik snapshot", value: "yok" },
      { label: "Hesaplama durumu", value: "not_calculated" }
    ];
  }
  return [
    { label: "Deterministik snapshot", value: "var" },
    { label: "Snapshot kaynagi", value: snapshot.cost_snapshot.provenance.source },
    { label: "Formul versiyonu", value: snapshot.cost_snapshot.formula_version },
    { label: "BOM satiri", value: snapshot.bom_snapshot.part_count },
    { label: "Kenar satiri", value: snapshot.bom_snapshot.edge_count },
    { label: "Ara toplam minor", value: snapshot.cost_snapshot.subtotal_minor },
    { label: "Genel toplam minor", value: snapshot.cost_snapshot.grand_total_minor },
    { label: "Para birimi", value: snapshot.cost_snapshot.currency }
  ];
}

function documentFacts(document: QuoteDocumentRecord | null): Array<{ label: string; value: unknown }> {
  if (!document) {
    return [
      { label: "Frozen belge", value: "yok" },
      { label: "PDF durumu", value: "deferred" }
    ];
  }
  return [
    { label: "Frozen belge", value: document.id },
    { label: "Belge tipi", value: document.document_type },
    { label: "Belge versiyonu", value: document.document_version },
    { label: "Belge hash", value: document.sha256 },
    { label: "Snapshot hash", value: document.snapshot_hash ?? "yok" },
    { label: "Hesaplama versiyonu", value: document.calculation_version ?? "yok" },
    { label: "PDF durumu", value: document.provenance.pdf_status },
    { label: "Depolama erisimi", value: document.provenance.storage }
  ];
}

function diffFacts(diff: QuoteRevisionDiffResponse): Array<{ label: string; value: unknown }> {
  return [
    { label: "Diff kaynagi", value: diff.source },
    { label: "Diff versiyonu", value: diff.diff_version },
    { label: "Sol revizyon", value: revisionLabel(diff.left_revision) },
    { label: "Sag revizyon", value: revisionLabel(diff.right_revision) },
    { label: "Fark sayisi", value: diff.entries.length },
    {
      label: "Ilk farklar",
      value: diff.entries.slice(0, 5).map((entry) => `${entry.category}.${entry.field}: ${entry.before} -> ${entry.after}`)
    }
  ];
}

export async function POST(request: Request) {
  return withReadSession(request, async ({ session }) => {
    let body: ChatPayload;
    try {
      const parsed = (await request.json()) as unknown;
      body = typeof parsed === "object" && parsed !== null ? parsed as ChatPayload : {};
    } catch {
      body = {};
    }

    const message = safeString(body.message);
    if (!message) {
      return safeError(422, "Message required", "A chat message is required.");
    }

    const { agentId, classification } = classifyMessage(message);
    if (looksLikePromptInjection(message)) {
      return NextResponse.json(responseBody({
        agentId,
        classification: promptInjectionBlockedMarker,
        status: "failed",
        summary: "Mesaj guvenli ajan politikasini asmaya calistigi icin arac calistirilmadi.",
        warnings: ["Prompt injection benzeri talep engellendi."]
      }));
    }

    if (asksForMutation(message)) {
      return NextResponse.json(responseBody({
        agentId,
        classification: mutationToolBlockedMarker,
        status: "failed",
        summary: "Bu sohbet katmani P6'da salt okunur; teklif gonderme, onay, PDF, uretim veya veri degisikligi yapamaz.",
        toolCalls: [deniedTool("agent-tool-1", "mutating_tool_request", "P6 salt okunur politika mutasyonu engelledi.")],
        proposedActions: [{
          action: "request_backend_approval_gate",
          description: "Riskli islemler icin once backend/domain onay kapisi tamamlanmali.",
          risk: "external",
          approval_required: false
        }],
        warnings: ["Ajan yazma araci calistirmadi ve musteriye giden belge uretmedi."]
      }));
    }

    const projectId = safeString(body.project_id);
    const documentId = safeString(body.document_id);
    const selectedRevisionId = safeString(body.quote_revision_id) ?? safeString(body.revision_id);
    const leftRevisionId = safeString(body.left_revision_id);
    const rightRevisionId = safeString(body.right_revision_id);
    const facts: Array<{ label: string; value: unknown }> = [];
    const toolCalls: SafeToolCall[] = [];
    const warnings = ["Ajan salt okunur calisir; BOM, maliyet, vergi, marj veya toplam hesaplamaz."];
    const missingInformation: string[] = [];

    let projectDetail: ProjectDetailRecord | null = null;
    let revisionDetail: QuoteRevisionDetailRecord | null = null;
    let configurationDraft: QuoteConfigurationDraftRecord | null = null;
    let quoteSnapshot: QuoteSnapshotResponse | null = null;
    let quoteDocument: QuoteDocumentRecord | null = null;

    if (projectId) {
      projectDetail = await getProjectDetail(session.mutationScope, projectId);
      toolCalls.push(completedTool("agent-tool-1", "get_project_detail", "Oturum sirketine ait proje okundu."));
      facts.push(...projectFacts(projectDetail));
    } else {
      const projects = await listProjects(session.mutationScope);
      toolCalls.push(completedTool("agent-tool-1", "list_projects", "Oturum sirketine ait projeler listelendi."));
      facts.push(
        { label: "Proje sayisi", value: projects.length },
        { label: "Son projeler", value: projects.slice(0, 3).map((project) => project.name).join(", ") || "kayit yok" }
      );
    }

    const revisionId = selectedRevisionId ?? projectDetail?.quote_revisions[0]?.id ?? null;
    if (revisionId) {
      revisionDetail = await getQuoteRevisionDetail(session.mutationScope, revisionId);
      if (projectDetail && revisionDetail.quote_revision.project_id !== projectDetail.project.id) {
        throw new Error("Selected revision was not found under the selected project.");
      }
      configurationDraft = await getQuoteConfigurationDraft(session.mutationScope, revisionId);
      quoteSnapshot = await getQuoteSnapshot(session.mutationScope, revisionId);
      toolCalls.push(completedTool("agent-tool-2", "get_quote_revision_detail", "Oturum sirketine ait revizyon okundu."));
      toolCalls.push(completedTool("agent-tool-3", "get_quote_configuration_draft", "Konfigurasyon taslagi salt okunur okundu."));
      toolCalls.push(completedTool("agent-tool-4", "get_quote_snapshot", "Deterministik snapshot salt okunur okundu."));
      facts.push(...revisionFacts(revisionDetail), ...configurationFacts(configurationDraft), ...snapshotFacts(quoteSnapshot));
    } else {
      missingInformation.push("Supabase proje veya revizyon secimi");
    }

    if (agentId === "revision_diff") {
      if (!leftRevisionId || !rightRevisionId) {
        missingInformation.push("karsilastirilacak iki revizyon");
      } else {
        const diff = await getQuoteRevisionDiff(session.mutationScope, leftRevisionId, rightRevisionId);
        toolCalls.push(completedTool("agent-tool-5", "get_revision_diff", "Deterministik revizyon farki salt okunur okundu."));
        facts.push(...diffFacts(diff));
      }
    }

    if (agentId === "quote_document") {
      if (documentId) {
        quoteDocument = await getQuoteDocument(session.mutationScope, documentId);
        toolCalls.push(completedTool("agent-tool-5", "get_quote_document", "Frozen teklif belgesi server rotasindan okundu."));
      } else if (revisionId) {
        const documents = await listQuoteDocuments(session.mutationScope, revisionId);
        quoteDocument = documents[0] ?? null;
        toolCalls.push(completedTool("agent-tool-5", "get_quote_document", "Revizyonun son frozen teklif belgesi arandi."));
      }
      facts.push(...documentFacts(quoteDocument));
      if (!quoteDocument) {
        missingInformation.push("snapshot'a bagli frozen teklif belgesi");
      }
    }

    if (agentId === "costing_pricing" && quoteSnapshot?.calculation_status !== "calculated") {
      missingInformation.push("deterministik cost snapshot");
    }

    if (!configurationDraft && agentId !== "enterprise_search") {
      missingInformation.push("olcu ve konfigurasyon taslagi");
    }

    const status: ResponseStatus = missingInformation.length ? "needs_input" : "completed";
    const summary = revisionDetail
      ? "Supabase oturumu ile proje/revizyon kayitlari okundu; riskli veya hesaplayici arac calistirilmadi."
      : "Supabase oturumu ile mevcut proje kayitlari listelendi; devam icin proje veya revizyon secilebilir.";

    return NextResponse.json(responseBody({
      agentId,
      classification: readOnlyGatewayMarker,
      status,
      summary,
      toolCalls,
      facts,
      warnings,
      missingInformation
    }));
  });
}
