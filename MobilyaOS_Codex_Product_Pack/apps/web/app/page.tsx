"use client";

import { FormEvent, MouseEvent, useEffect, useMemo, useState } from "react";
import {
  AgentChatResponse,
  apiBaseUrl,
  ApiError,
  Customer,
  DiffResponse,
  QuoteDocument,
  QuoteRevision,
  SupabaseDemoLoginResponse,
  SupabaseDemoOverview,
  SupabaseApprovalGate,
  SupabaseProjectDetail,
  SupabaseQuoteConfigurationDraftResponse,
  SupabaseQuoteDocument,
  SupabaseQuoteDocumentPreview,
  SupabaseQuoteForkResponse,
  SupabaseQuoteRevisionDetail,
  SupabaseQuoteRevisionDiff,
  SupabaseQuoteSnapshotResponse,
  SupabaseSessionResponse
} from "../lib/api";

type Step = "login" | "seed" | "customer" | "project" | "wardrobe" | "quote" | "fork" | "diff";

const steps: Array<{ id: Step; label: string }> = [
  { id: "login", label: "Giris" },
  { id: "seed", label: "Demo veri" },
  { id: "customer", label: "Musteri" },
  { id: "project", label: "Proje" },
  { id: "wardrobe", label: "Gardrop" },
  { id: "quote", label: "Teklif" },
  { id: "fork", label: "Revizyon" },
  { id: "diff", label: "Farklar" }
];

const idempotency = () => `ui-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export default function HomePage() {
  const [step, setStep] = useState<Step>("login");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [projectId, setProjectId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [revision, setRevision] = useState<QuoteRevision | null>(null);
  const [forkedRevision, setForkedRevision] = useState<QuoteRevision | null>(null);
  const [document, setDocument] = useState<QuoteDocument | null>(null);
  const [diff, setDiff] = useState<DiffResponse | null>(null);
  const [seedSummary, setSeedSummary] = useState("");
  const [cloudData, setCloudData] = useState<SupabaseDemoOverview | null>(null);
  const [cloudSession, setCloudSession] = useState<SupabaseSessionResponse | null>(null);
  const [cloudProjectDetail, setCloudProjectDetail] = useState<SupabaseProjectDetail | null>(null);
  const [cloudRevisionDetail, setCloudRevisionDetail] = useState<SupabaseQuoteRevisionDetail | null>(null);
  const [cloudConfigurationDraft, setCloudConfigurationDraft] = useState<SupabaseQuoteConfigurationDraftResponse | null>(null);
  const [cloudQuoteSnapshot, setCloudQuoteSnapshot] = useState<SupabaseQuoteSnapshotResponse | null>(null);
  const [cloudDocuments, setCloudDocuments] = useState<SupabaseQuoteDocument[]>([]);
  const [cloudDocumentPreview, setCloudDocumentPreview] = useState<SupabaseQuoteDocumentPreview | null>(null);
  const [cloudRevisionDiff, setCloudRevisionDiff] = useState<SupabaseQuoteRevisionDiff | null>(null);
  const [cloudApprovalGate, setCloudApprovalGate] = useState<SupabaseApprovalGate | null>(null);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [chatInput, setChatInput] = useState("Bu projenin maliyet snapshot sonucunu acikla");
  const [chatResult, setChatResult] = useState<AgentChatResponse | null>(null);
  const [chatBusy, setChatBusy] = useState(false);

  const grandTotal = useMemo(() => revision?.cost.grand_total ?? null, [revision]);

  useEffect(() => {
    void refreshSupabaseSession();
  }, []);

  async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    setError("");
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.method && options.method !== "GET" ? { "Idempotency-Key": idempotency() } : {}),
        ...options.headers
      }
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as ApiError;
      throw new Error(payload.detail || payload.title || `HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const response = await request<{ access_token: string }>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password")
        })
      });
      setToken(response.access_token);
      setStep("seed");
    } catch (caught) {
      setError(String(caught instanceof Error ? caught.message : caught));
    }
  }

  async function verifySupabaseLogin(event: MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form;
    if (!form) return;
    const formData = new FormData(form);
    setCloudBusy(true);
    setError("");
    try {
      const response = await fetch("/api/supabase/demo-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.get("email"),
          password: formData.get("password")
        })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as ApiError;
        throw new Error(payload.detail || payload.title || `HTTP ${response.status}`);
      }
      const loginResponse = (await response.json()) as SupabaseDemoLoginResponse;
      setCloudSession({
        authenticated: true,
        app_user: loginResponse.app_user,
        company: loginResponse.company,
        expires_at: loginResponse.expires_at
      });
      setStep("seed");
    } catch (caught) {
      setError(String(caught instanceof Error ? caught.message : caught));
    } finally {
      setCloudBusy(false);
    }
  }

  async function refreshSupabaseSession() {
    try {
      const response = await fetch("/api/supabase/session", {
        cache: "no-store",
        credentials: "same-origin"
      });
      if (!response.ok) {
        setCloudSession(null);
        return;
      }
      setCloudSession((await response.json()) as SupabaseSessionResponse);
    } catch {
      setCloudSession(null);
    }
  }

  async function logoutSupabase() {
    setCloudBusy(true);
    setError("");
    try {
      await fetch("/api/supabase/logout", {
        method: "POST",
        credentials: "same-origin"
      });
      setCloudSession(null);
      setCloudData(null);
      setCloudProjectDetail(null);
      setCloudRevisionDetail(null);
      setCloudQuoteSnapshot(null);
      setCloudDocuments([]);
      setCloudDocumentPreview(null);
      setCloudRevisionDiff(null);
      setCloudApprovalGate(null);
      setSeedSummary("");
      setStep("login");
    } finally {
      setCloudBusy(false);
    }
  }

  async function loadSeed() {
    await refreshCloudOverview(true);
  }

  async function refreshCloudOverview(advance: boolean) {
    try {
      const response = await fetch("/api/supabase/demo-data", {
        cache: "no-store",
        credentials: "same-origin"
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as ApiError;
        throw new Error(payload.detail || payload.title || `HTTP ${response.status}`);
      }
      const overview = (await response.json()) as SupabaseDemoOverview;
      setCloudData(overview);
      setSeedSummary(
        `${overview.company.name}: ${overview.customers.length} musteri, ${overview.projects.length} proje, ${overview.quote_revisions.length} revizyon`
      );
      if (advance) {
        setStep("customer");
      }
    } catch (caught) {
      setError(String(caught instanceof Error ? caught.message : caught));
    }
  }

  async function supabasePost<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const response = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "x-idempotency-key": idempotency()
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as ApiError;
      throw new Error(payload.detail || payload.title || `HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  }

  async function supabasePatch<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const response = await fetch(path, {
      method: "PATCH",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "x-idempotency-key": idempotency()
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as ApiError;
      throw new Error(payload.detail || payload.title || `HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  }

  async function supabaseGet<T>(path: string): Promise<T> {
    const response = await fetch(path, {
      cache: "no-store",
      credentials: "same-origin"
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as ApiError;
      throw new Error(payload.detail || payload.title || `HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  }

  async function loadSupabaseProjectDetail(projectId: string) {
    setCloudBusy(true);
    setError("");
    try {
      const detail = await supabaseGet<SupabaseProjectDetail>(`/api/supabase/projects/${projectId}`);
      setCloudProjectDetail(detail);
      if (detail.quote_revisions[0]) {
        await loadSupabaseQuoteRevisionDetail(detail.quote_revisions[0].id, false);
      }
    } catch (caught) {
      setError(String(caught instanceof Error ? caught.message : caught));
    } finally {
      setCloudBusy(false);
    }
  }

  async function loadSupabaseQuoteRevisionDetail(quoteRevisionId: string, setBusy = true) {
    if (setBusy) {
      setCloudBusy(true);
    }
    setError("");
    try {
      const detail = await supabaseGet<SupabaseQuoteRevisionDetail>(`/api/supabase/quote-revisions/${quoteRevisionId}`);
      setCloudRevisionDetail(detail);
      setCloudDocumentPreview(null);
      setCloudRevisionDiff(null);
      await Promise.all([
        loadSupabaseConfigurationDraft(quoteRevisionId, false),
        loadSupabaseQuoteSnapshot(quoteRevisionId, false),
        loadSupabaseQuoteDocuments(quoteRevisionId, false),
        loadSupabaseApprovalStatus(quoteRevisionId, false)
      ]);
    } catch (caught) {
      setError(String(caught instanceof Error ? caught.message : caught));
    } finally {
      if (setBusy) {
        setCloudBusy(false);
      }
    }
  }

  async function loadSupabaseConfigurationDraft(quoteRevisionId: string, setBusy = true) {
    if (setBusy) {
      setCloudBusy(true);
    }
    setError("");
    try {
      const result = await supabaseGet<SupabaseQuoteConfigurationDraftResponse>(
        `/api/supabase/quote-revisions/${quoteRevisionId}/configuration-draft`
      );
      setCloudConfigurationDraft(result);
    } catch (caught) {
      setError(String(caught instanceof Error ? caught.message : caught));
    } finally {
      if (setBusy) {
        setCloudBusy(false);
      }
    }
  }

  async function loadSupabaseQuoteSnapshot(quoteRevisionId: string, setBusy = true) {
    if (setBusy) {
      setCloudBusy(true);
    }
    setError("");
    try {
      const result = await supabaseGet<SupabaseQuoteSnapshotResponse>(
        `/api/supabase/quote-revisions/${quoteRevisionId}/snapshot`
      );
      setCloudQuoteSnapshot(result);
    } catch (caught) {
      setError(String(caught instanceof Error ? caught.message : caught));
    } finally {
      if (setBusy) {
        setCloudBusy(false);
      }
    }
  }

  async function loadSupabaseQuoteDocuments(quoteRevisionId: string, setBusy = true) {
    if (setBusy) {
      setCloudBusy(true);
    }
    setError("");
    try {
      const result = await supabaseGet<{ documents: SupabaseQuoteDocument[] }>(
        `/api/supabase/quote-revisions/${quoteRevisionId}/documents`
      );
      setCloudDocuments(result.documents);
    } catch (caught) {
      setError(String(caught instanceof Error ? caught.message : caught));
      setCloudDocuments([]);
    } finally {
      if (setBusy) {
        setCloudBusy(false);
      }
    }
  }

  async function loadSupabaseApprovalStatus(quoteRevisionId: string, setBusy = true) {
    if (setBusy) {
      setCloudBusy(true);
    }
    setError("");
    try {
      const result = await supabaseGet<{ approval_gate: SupabaseApprovalGate }>(
        `/api/supabase/quote-revisions/${quoteRevisionId}/approval-status`
      );
      setCloudApprovalGate(result.approval_gate);
    } catch (caught) {
      setError(String(caught instanceof Error ? caught.message : caught));
      setCloudApprovalGate(null);
    } finally {
      if (setBusy) {
        setCloudBusy(false);
      }
    }
  }

  function configurationBodyFromForm(form: FormData): Record<string, unknown> {
    return {
      template_code: form.get("template_code"),
      width_mm: form.get("width_mm"),
      height_mm: form.get("height_mm"),
      depth_mm: form.get("depth_mm"),
      quantity: form.get("quantity"),
      door_count: form.get("door_count"),
      shelf_count: form.get("shelf_count"),
      material_sku: form.get("material_sku"),
      edge_band_sku: form.get("edge_band_sku"),
      notes: form.get("notes")
    };
  }

  async function saveSupabaseConfigurationDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const revisionId = cloudRevisionDetail?.quote_revision.id;
    if (!revisionId) {
      setError("Supabase revizyon secimi gerekli.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const body = configurationBodyFromForm(form);
    if (cloudConfigurationDraft?.configuration_draft) {
      body.expected_version = cloudConfigurationDraft.configuration_draft.version;
    }
    setCloudBusy(true);
    setError("");
    try {
      const path = `/api/supabase/quote-revisions/${revisionId}/configuration-draft`;
      const result = cloudConfigurationDraft?.configuration_draft
        ? await supabasePatch<SupabaseQuoteConfigurationDraftResponse>(path, body)
        : await supabasePost<SupabaseQuoteConfigurationDraftResponse>(path, body);
      setCloudConfigurationDraft(result);
      setCloudQuoteSnapshot(null);
      setSeedSummary(`Supabase konfigurasyon taslagi kaydedildi: v${result.configuration_draft?.version ?? 0}`);
      await refreshCloudOverview(false);
      await loadSupabaseQuoteRevisionDetail(revisionId, false);
    } catch (caught) {
      setError(String(caught instanceof Error ? caught.message : caught));
    } finally {
      setCloudBusy(false);
    }
  }

  async function createSupabaseCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setCloudBusy(true);
    setError("");
    try {
      const result = await supabasePost<{ customer: SupabaseDemoOverview["customers"][number] }>("/api/supabase/customers", {
        name: form.get("name"),
        email: form.get("email"),
        phone: form.get("phone")
      });
      setSeedSummary(`Supabase musteri olustu: ${result.customer.name}`);
      await refreshCloudOverview(false);
      event.currentTarget.reset();
    } catch (caught) {
      setError(String(caught instanceof Error ? caught.message : caught));
    } finally {
      setCloudBusy(false);
    }
  }

  async function createSupabaseProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setCloudBusy(true);
    setError("");
    try {
      const result = await supabasePost<{ project: SupabaseDemoOverview["projects"][number] }>("/api/supabase/projects", {
        customer_id: form.get("customer_id"),
        name: form.get("name")
      });
      setSeedSummary(`Supabase proje olustu: ${result.project.name}`);
      await refreshCloudOverview(false);
      await loadSupabaseProjectDetail(result.project.id);
      event.currentTarget.reset();
    } catch (caught) {
      setError(String(caught instanceof Error ? caught.message : caught));
    } finally {
      setCloudBusy(false);
    }
  }

  async function createSupabaseQuoteDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const projectId = String(form.get("project_id") ?? "");
    if (!projectId) {
      setError("Supabase proje secimi gerekli.");
      return;
    }
    setCloudBusy(true);
    setError("");
    try {
      const result = await supabasePost<{ quote_revision: SupabaseDemoOverview["quote_revisions"][number] }>(
        `/api/supabase/projects/${projectId}/quote-drafts`,
        {}
      );
      setSeedSummary(`Supabase teklif taslagi olustu: R${result.quote_revision.revision_number} (${result.quote_revision.status})`);
      await refreshCloudOverview(false);
      await loadSupabaseProjectDetail(projectId);
      await loadSupabaseQuoteRevisionDetail(result.quote_revision.id);
    } catch (caught) {
      setError(String(caught instanceof Error ? caught.message : caught));
    } finally {
      setCloudBusy(false);
    }
  }

  async function calculateSupabaseQuoteSnapshot() {
    const revisionId = cloudRevisionDetail?.quote_revision.id;
    const configurationVersion = cloudConfigurationDraft?.configuration_draft?.version;
    if (!revisionId || !configurationVersion) {
      setError("Hesaplama icin kayitli Supabase konfigurasyon taslagi gerekli.");
      return;
    }
    setCloudBusy(true);
    setError("");
    try {
      const result = await supabasePost<SupabaseQuoteSnapshotResponse>(
        `/api/supabase/quote-revisions/${revisionId}/calculate`,
        { expected_configuration_version: configurationVersion }
      );
      setCloudQuoteSnapshot(result);
      setCloudDocumentPreview(null);
      setCloudRevisionDiff(null);
      setSeedSummary(`Deterministik snapshot kaydedildi: ${result.cost_snapshot ? money(result.cost_snapshot.grand_total_minor, result.cost_snapshot.currency) : "hesaplanmadi"}`);
      await refreshCloudOverview(false);
      await loadSupabaseQuoteRevisionDetail(revisionId, false);
    } catch (caught) {
      setError(String(caught instanceof Error ? caught.message : caught));
    } finally {
      setCloudBusy(false);
    }
  }

  async function generateSupabaseQuoteDocument() {
    const revisionId = cloudRevisionDetail?.quote_revision.id;
    if (!revisionId) {
      setError("Teklif belgesi icin Supabase revizyon secimi gerekli.");
      return;
    }
    setCloudBusy(true);
    setError("");
    try {
      const result = await supabasePost<{ document: SupabaseQuoteDocumentPreview }>(
        `/api/supabase/quote-revisions/${revisionId}/documents`,
        {}
      );
      setCloudDocumentPreview(result.document);
      setSeedSummary(`Frozen teklif belgesi uretildi: ${result.document.sha256.slice(0, 12)}`);
      await refreshCloudOverview(false);
      await loadSupabaseQuoteDocuments(revisionId, false);
    } catch (caught) {
      setError(String(caught instanceof Error ? caught.message : caught));
    } finally {
      setCloudBusy(false);
    }
  }

  async function loadSupabaseQuoteDocumentPreview(documentId: string) {
    setCloudBusy(true);
    setError("");
    try {
      const result = await supabaseGet<{ document: SupabaseQuoteDocumentPreview }>(`/api/supabase/documents/${documentId}`);
      setCloudDocumentPreview(result.document);
    } catch (caught) {
      setError(String(caught instanceof Error ? caught.message : caught));
    } finally {
      setCloudBusy(false);
    }
  }

  async function forkSupabaseQuoteRevision() {
    const revision = cloudRevisionDetail?.quote_revision;
    if (!revision) {
      setError("Revizyon catali icin Supabase revizyon secimi gerekli.");
      return;
    }
    setCloudBusy(true);
    setError("");
    try {
      const result = await supabasePost<SupabaseQuoteForkResponse>(
        `/api/supabase/quote-revisions/${revision.id}/fork`,
        { expected_revision_version: revision.version }
      );
      setSeedSummary(`Revizyon catali olustu: R${result.quote_revision.revision_number}`);
      await refreshCloudOverview(false);
      await loadSupabaseProjectDetail(result.quote_revision.project_id);
      await loadSupabaseQuoteRevisionDetail(result.quote_revision.id, false);
      await loadSupabaseRevisionDiff(result.quote_revision.parent_revision_id ?? revision.id, result.quote_revision.id, false);
    } catch (caught) {
      setError(String(caught instanceof Error ? caught.message : caught));
    } finally {
      setCloudBusy(false);
    }
  }

  async function loadSupabaseRevisionDiff(leftId?: string, rightId?: string, setBusy = true) {
    const rightRevisionId = rightId ?? cloudRevisionDetail?.quote_revision.id;
    const leftRevisionId = leftId
      ?? cloudRevisionDetail?.quote_revision.parent_revision_id
      ?? cloudProjectDetail?.quote_revisions.find((candidate) => candidate.id !== rightRevisionId)?.id;
    if (!leftRevisionId || !rightRevisionId || leftRevisionId === rightRevisionId) {
      setError("Fark karsilastirmasi icin iki Supabase revizyonu gerekli.");
      return;
    }
    if (setBusy) {
      setCloudBusy(true);
    }
    setError("");
    try {
      const result = await supabaseGet<{ diff: SupabaseQuoteRevisionDiff }>(
        `/api/supabase/quote-revisions/${leftRevisionId}/diff?against=${encodeURIComponent(rightRevisionId)}`
      );
      setCloudRevisionDiff(result.diff);
    } catch (caught) {
      setError(String(caught instanceof Error ? caught.message : caught));
    } finally {
      if (setBusy) {
        setCloudBusy(false);
      }
    }
  }

  async function prepareSupabaseApprovalGate() {
    const revisionId = cloudRevisionDetail?.quote_revision.id;
    const documentId = cloudDocumentPreview?.id ?? cloudDocuments[0]?.id;
    if (!revisionId || !documentId) {
      setError("Onay kapisi icin snapshot'a bagli frozen belge gerekli.");
      return;
    }
    setCloudBusy(true);
    setError("");
    try {
      const result = await supabasePost<{ approval_gate: SupabaseApprovalGate }>(
        `/api/supabase/quote-revisions/${revisionId}/approval-token`,
        { document_id: documentId }
      );
      setCloudApprovalGate(result.approval_gate);
      setSeedSummary(`Onay kapisi hazirlandi: ${result.approval_gate.status}`);
      await refreshCloudOverview(false);
    } catch (caught) {
      setError(String(caught instanceof Error ? caught.message : caught));
    } finally {
      setCloudBusy(false);
    }
  }

  async function createCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const created = await request<Customer>("/api/v1/customers", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          phone: form.get("phone")
        })
      });
      setCustomer(created);
      setStep("project");
    } catch (caught) {
      setError(String(caught instanceof Error ? caught.message : caught));
    }
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customer) return;
    const form = new FormData(event.currentTarget);
    try {
      const created = await request<{ id: string; name: string }>("/api/v1/projects", {
        method: "POST",
        body: JSON.stringify({
          customer_id: customer.id,
          name: form.get("name")
        })
      });
      setProjectId(created.id);
      setProjectName(created.name);
      setStep("wardrobe");
    } catch (caught) {
      setError(String(caught instanceof Error ? caught.message : caught));
    }
  }

  async function createWardrobe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const created = await request<QuoteRevision>("/api/v1/revisions/wardrobe", {
        method: "POST",
        body: JSON.stringify({
          project_id: projectId,
          quantity: Number(form.get("quantity")),
          width_mm: Number(form.get("width_mm")),
          height_mm: Number(form.get("height_mm")),
          depth_mm: Number(form.get("depth_mm")),
          material_sku: "PNL-MDF-18-BEYAZ",
          edge_band_sku: "EDGE-PVC-22-BEYAZ",
          shelf_count: Number(form.get("shelf_count")),
          door_count: Number(form.get("door_count")),
          markup_bps: 2500,
          vat_bps: 2000
        })
      });
      setRevision(created);
      setStep("quote");
    } catch (caught) {
      setError(String(caught instanceof Error ? caught.message : caught));
    }
  }

  async function generateDocument() {
    if (!revision) return;
    try {
      const created = await request<QuoteDocument>(`/api/v1/revisions/${revision.id}/quote-document`, { method: "POST", body: "{}" });
      setDocument(created);
      setStep("fork");
    } catch (caught) {
      setError(String(caught instanceof Error ? caught.message : caught));
    }
  }

  async function forkRevision() {
    if (!revision) return;
    try {
      const forked = await request<QuoteRevision>(`/api/v1/revisions/${revision.id}/fork`, {
        method: "POST",
        body: JSON.stringify({ patch: { width_mm: 2000, quantity: 3 } })
      });
      setForkedRevision(forked);
      setStep("diff");
    } catch (caught) {
      setError(String(caught instanceof Error ? caught.message : caught));
    }
  }

  async function loadDiff() {
    if (!revision || !forkedRevision) return;
    try {
      const loaded = await request<DiffResponse>(`/api/v1/revisions/${revision.id}/diff/${forkedRevision.id}`);
      setDiff(loaded);
    } catch (caught) {
      setError(String(caught instanceof Error ? caught.message : caught));
    }
  }

  async function sendChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setChatBusy(true);
    setError("");
    try {
      const activeProjectId = cloudProjectDetail?.project.id || projectId || undefined;
      const activeRevisionId = cloudRevisionDetail?.quote_revision.id || revision?.id || undefined;
      const response = await fetch("/api/supabase/agent-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "same-origin",
        body: JSON.stringify({
          message: chatInput,
          document_id: cloudDocumentPreview?.id || cloudDocuments[0]?.id || undefined,
          project_id: activeProjectId,
          quote_revision_id: activeRevisionId,
          left_revision_id: cloudProjectDetail?.quote_revisions[0]?.id || revision?.id || undefined,
          right_revision_id: cloudProjectDetail?.quote_revisions[1]?.id || forkedRevision?.id || undefined
        })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as ApiError;
        throw new Error(payload.detail || payload.title || `HTTP ${response.status}`);
      }
      setChatResult((await response.json()) as AgentChatResponse);
    } catch (caught) {
      setError(String(caught instanceof Error ? caught.message : caught));
    } finally {
      setChatBusy(false);
    }
  }

  return (
    <main className="shell">
      <aside className="sidebar" aria-label="Ana navigasyon">
        <p className="brand">MobilyaOS</p>
        <nav className="nav">
          {steps.map((item) => (
            <button className={item.id === step ? "activeNav" : ""} key={item.id} onClick={() => setStep(item.id)} type="button">
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <section className="content">
        <p className="topline">P3 dikey dilim</p>
        <h1 className="title">Gardrop teklif akisi</h1>
        {error ? <div className="error">{error}</div> : null}
        {cloudSession ? (
          <div className="sessionBar">
            <span>{cloudSession.app_user.email}</span>
            <span>{cloudSession.app_user.role}</span>
            <span>{cloudSession.company.name}</span>
            <button disabled={cloudBusy} onClick={logoutSupabase} type="button">Oturumu kapat</button>
          </div>
        ) : null}

        {step === "login" ? (
          <form className="panel" onSubmit={login}>
            <h2>Demo kullanici girisi</h2>
            <label>E-posta<input name="email" defaultValue="satis@demo.local" /></label>
            <label>Sifre<input name="password" type="password" defaultValue="Demo1234!ChangeMe" /></label>
            <div className="buttonRow">
              <button type="submit">Go demo girisi</button>
              <button disabled={cloudBusy} onClick={verifySupabaseLogin} type="button">
                {cloudBusy ? "Oturum aciliyor" : "Supabase oturumu ac"}
              </button>
            </div>
            <p className="smallNote">
              Supabase girisi gercek Auth kullanicisini app_users kaydina esler ve HTTP-only demo oturumu olusturur.
            </p>
            {cloudSession ? (
              <div className="successBox">
                Supabase oturumu acik: {cloudSession.app_user.email} ({cloudSession.app_user.role}) - {cloudSession.company.name}
              </div>
            ) : null}
          </form>
        ) : null}

        {step === "seed" ? (
          <section className="panel">
            <h2>Demo sirket ve katalog</h2>
            <p>{seedSummary || "Demo katalog Supabase oturumu ile yuklenecek."}</p>
            {cloudSession ? (
              <div className="successBox">
                Oturum: {cloudSession.app_user.role} - {cloudSession.company.name}
              </div>
            ) : (
              <div className="warningBox">Supabase demo verisini yuklemek icin once oturum acin.</div>
            )}
            <div className="buttonRow">
              <button disabled={!cloudSession || cloudBusy} onClick={loadSeed} type="button">Supabase demo veriyi yukle</button>
              <button disabled={cloudBusy} onClick={logoutSupabase} type="button">Supabase oturumunu kapat</button>
            </div>
          </section>
        ) : null}

        {cloudData ? (
          <SupabaseOverview
            onLoadProjectDetail={loadSupabaseProjectDetail}
            onLoadRevisionDetail={loadSupabaseQuoteRevisionDetail}
            overview={cloudData}
          />
        ) : null}

        {cloudProjectDetail || cloudRevisionDetail ? (
          <SupabaseTimelinePanel
            approvalGate={cloudApprovalGate}
            busy={cloudBusy}
            canPrepareApproval={cloudSession?.app_user.role === "admin"}
            configurationDraft={cloudConfigurationDraft}
            documentPreview={cloudDocumentPreview}
            documents={cloudDocuments}
            onCalculateQuoteSnapshot={calculateSupabaseQuoteSnapshot}
            onForkRevision={forkSupabaseQuoteRevision}
            onGenerateQuoteDocument={generateSupabaseQuoteDocument}
            onLoadDocumentPreview={loadSupabaseQuoteDocumentPreview}
            onSaveConfigurationDraft={saveSupabaseConfigurationDraft}
            onLoadRevisionDiff={() => loadSupabaseRevisionDiff()}
            projectDetail={cloudProjectDetail}
            quoteSnapshot={cloudQuoteSnapshot}
            revisionDiff={cloudRevisionDiff}
            revisionDetail={cloudRevisionDetail}
            onPrepareApprovalGate={prepareSupabaseApprovalGate}
            onLoadRevisionDetail={loadSupabaseQuoteRevisionDetail}
          />
        ) : null}

        {cloudSession && cloudData ? (
          <SupabaseMutationPanel
            busy={cloudBusy}
            onCreateCustomer={createSupabaseCustomer}
            onCreateProject={createSupabaseProject}
            onCreateQuoteDraft={createSupabaseQuoteDraft}
            overview={cloudData}
          />
        ) : null}

        {step === "customer" ? (
          <form className="panel" onSubmit={createCustomer}>
            <h2>Musteri olustur</h2>
            <div className="warningBox">Bu mutasyon akisi henuz Supabase'e yazmaz; Go core demo API yolunu kullanir.</div>
            <label>Musteri adi<input name="name" defaultValue="Ayse Yilmaz" /></label>
            <label>E-posta<input name="email" defaultValue="ayse@example.local" /></label>
            <label>Telefon<input name="phone" defaultValue="+90 555 111 22 33" /></label>
            <button type="submit">Musteriyi kaydet</button>
          </form>
        ) : null}

        {step === "project" ? (
          <form className="panel" onSubmit={createProject}>
            <h2>Proje olustur</h2>
            <p>Musteri: {customer?.name}</p>
            <label>Proje adi<input name="name" defaultValue="Ayse Yilmaz Vestiyer" /></label>
            <button type="submit">Projeyi ac</button>
          </form>
        ) : null}

        {step === "wardrobe" ? (
          <form className="panel" onSubmit={createWardrobe}>
            <h2>Gardrop konfigürasyonu</h2>
            <p>Proje: {projectName}</p>
            <div className="formGrid">
              <label>Adet<input name="quantity" type="number" defaultValue={2} /></label>
              <label>Genislik mm<input name="width_mm" type="number" defaultValue={1800} /></label>
              <label>Yukseklik mm<input name="height_mm" type="number" defaultValue={2200} /></label>
              <label>Derinlik mm<input name="depth_mm" type="number" defaultValue={600} /></label>
              <label>Raf adedi<input name="shelf_count" type="number" defaultValue={3} /></label>
              <label>Kapak adedi<input name="door_count" type="number" defaultValue={3} /></label>
            </div>
            <button type="submit">BOM, kenar, iscilik ve maliyeti hesapla</button>
          </form>
        ) : null}

        {revision ? (
          <section className="section">
            <h2>Yetkili hesaplama sonucu</h2>
            <div className="grid">
              <SummaryCard title="BOM" value={`${revision.bom.length} satir`} />
              <SummaryCard title="Kenar bandi" value={`${revision.edges.length} politika satiri`} />
              <SummaryCard title="Iscilik" value={money(revision.labor.reduce((sum, item) => sum + item.total_cost.amount_minor, 0))} />
              <SummaryCard title="Genel toplam" value={grandTotal ? money(grandTotal.amount_minor) : "-"} />
            </div>
            <ResultTables revision={revision} />
          </section>
        ) : null}

        {step === "quote" && revision ? (
          <section className="panel">
            <h2>Teklif onizleme</h2>
            <p>Toplam: {money(revision.cost.grand_total.amount_minor)}</p>
            <button onClick={generateDocument} type="button">HTML teklif belgesi olustur</button>
          </section>
        ) : null}

        {document ? (
          <section className="panel">
            <h2>Teklif belgesi</h2>
            <p>SHA-256: <code>{document.sha256}</code></p>
            <iframe className="quoteFrame" sandbox="" srcDoc={document.html} title="Teklif belgesi" />
          </section>
        ) : null}

        {step === "fork" && revision ? (
          <section className="panel">
            <h2>Revizyon catali</h2>
            <p>Yeni revizyonda genislik 2000 mm ve adet 3 olarak yeniden hesaplanacak.</p>
            <button onClick={forkRevision} type="button">Revizyonu catalla</button>
          </section>
        ) : null}

        {step === "diff" && forkedRevision ? (
          <section className="panel">
            <h2>Revizyon farklari</h2>
            <button onClick={loadDiff} type="button">Farklari getir</button>
            {diff ? (
              <table className="table">
                <thead><tr><th>Kategori</th><th>Alan</th><th>Once</th><th>Sonra</th></tr></thead>
                <tbody>
                  {diff.entries.map((entry) => (
                    <tr key={`${entry.category}-${entry.field}`}>
                      <td>{entry.category}</td>
                      <td>{entry.field}</td>
                      <td>{entry.before}</td>
                      <td>{entry.after}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </section>
        ) : null}

        <section className="agentPanel" aria-label="MobilyaOS ajan sohbeti">
          <div>
            <p className="topline">Kuralli ajan katmani</p>
            <h2>Tek sohbet arayuzu</h2>
          </div>
          <form className="chatForm" onSubmit={sendChat}>
            <label>
              Mesaj
              <textarea onChange={(event) => setChatInput(event.target.value)} value={chatInput} />
            </label>
            <button disabled={chatBusy} type="submit">{chatBusy ? "Calisiyor" : "Ajana sor"}</button>
          </form>
          {chatResult ? (
            <div className="chatResult">
              <div className="chatHeader">
                <span className="status">{chatResult.agent_id}</span>
                <span className="status">{chatResult.response.status}</span>
              </div>
              <p>{chatResult.response.summary}</p>
              {chatResult.response.warnings.length ? (
                <div className="warningBox">{chatResult.response.warnings.join(" ")}</div>
              ) : null}
              {chatResult.response.missing_information.length ? (
                <p>Eksik bilgi: {chatResult.response.missing_information.join(", ")}</p>
              ) : null}
              {chatResult.response.facts.length ? (
                <table className="table">
                  <tbody>
                    {chatResult.response.facts.map((fact) => (
                      <tr key={`${fact.label}-${JSON.stringify(fact.value)}`}>
                        <td>{fact.label}</td>
                        <td>{renderFactValue(fact.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
              {chatResult.tool_calls.length ? (
                <div className="toolList">
                  {chatResult.tool_calls.map((call) => (
                    <span className="toolChip" key={call.id}>
                      {call.tool}.{call.action}: {call.status}
                    </span>
                  ))}
                </div>
              ) : null}
              {chatResult.response.proposed_actions.length ? (
                <div className="approvalBox">
                  {chatResult.response.proposed_actions.map((action) => (
                    <p key={action.action}>
                      {action.description} {action.approval_required ? "(onay gerekli)" : ""}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}

function SupabaseOverview({
  onLoadProjectDetail,
  onLoadRevisionDetail,
  overview
}: {
  onLoadProjectDetail: (projectId: string) => void;
  onLoadRevisionDetail: (quoteRevisionId: string) => void;
  overview: SupabaseDemoOverview;
}) {
  const latestCost = overview.cost_snapshots[0];
  return (
    <section className="section">
      <h2>Supabase Cloud demo verisi</h2>
      <div className="grid">
        <SummaryCard title="Sirket" value={overview.company.name} />
        <SummaryCard title="Kullanicilar" value={`${overview.app_users.length} app_user`} />
        <SummaryCard title="Projeler" value={`${overview.projects.length} proje`} />
        <SummaryCard title="Revizyonlar" value={`${overview.quote_revisions.length} revizyon`} />
        <SummaryCard title="BOM snapshot" value={`${overview.bom_snapshots.length} kayit`} />
        <SummaryCard
          title="Son maliyet"
          value={latestCost ? money(latestCost.grand_total_minor) : "-"}
        />
      </div>
      <div className="splitTables">
        <div>
          <h3>Musteriler</h3>
          <table className="table">
            <tbody>
              {overview.customers.map((customer) => (
                <tr key={customer.id}>
                  <td>{customer.name}</td>
                  <td>{customer.email || "-"}</td>
                  <td>{customer.phone || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h3>Projeler</h3>
          <table className="table">
            <tbody>
              {overview.projects.map((project) => (
                <tr key={project.id}>
                  <td>{project.name}</td>
                  <td>{project.customer_name || "-"}</td>
                  <td>{project.status}</td>
                  <td><button type="button" onClick={() => onLoadProjectDetail(project.id)}>Detay</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="splitTables">
        <div>
          <h3>Teklif revizyonlari</h3>
          <table className="table">
            <tbody>
              {overview.quote_revisions.map((revision) => (
                <tr key={revision.id}>
                  <td>R{revision.revision_number}</td>
                  <td>{revision.status}</td>
                  <td>{revision.project_id.slice(0, 8)}</td>
                  <td><button type="button" onClick={() => onLoadRevisionDetail(revision.id)}>Durum</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h3>Maliyet snapshotlari</h3>
          <table className="table">
            <tbody>
              {overview.cost_snapshots.map((snapshot) => (
                <tr key={snapshot.id}>
                  <td>{snapshot.formula_version}</td>
                  <td>{money(snapshot.grand_total_minor)}</td>
                  <td>{snapshot.category_count} kategori</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="warningBox">
        {overview.limitations.join(" ")}
      </div>
    </section>
  );
}

function SupabaseTimelinePanel({
  approvalGate,
  busy,
  canPrepareApproval,
  configurationDraft,
  documentPreview,
  documents,
  onCalculateQuoteSnapshot,
  onForkRevision,
  onGenerateQuoteDocument,
  onLoadDocumentPreview,
  onLoadRevisionDiff,
  onLoadRevisionDetail,
  onPrepareApprovalGate,
  onSaveConfigurationDraft,
  projectDetail,
  quoteSnapshot,
  revisionDiff,
  revisionDetail
}: {
  approvalGate: SupabaseApprovalGate | null;
  busy: boolean;
  canPrepareApproval: boolean;
  configurationDraft: SupabaseQuoteConfigurationDraftResponse | null;
  documentPreview: SupabaseQuoteDocumentPreview | null;
  documents: SupabaseQuoteDocument[];
  onCalculateQuoteSnapshot: () => void;
  onForkRevision: () => void;
  onGenerateQuoteDocument: () => void;
  onLoadDocumentPreview: (documentId: string) => void;
  onLoadRevisionDiff: () => void;
  onLoadRevisionDetail: (quoteRevisionId: string) => void;
  onPrepareApprovalGate: () => void;
  onSaveConfigurationDraft: (event: FormEvent<HTMLFormElement>) => void;
  projectDetail: SupabaseProjectDetail | null;
  quoteSnapshot: SupabaseQuoteSnapshotResponse | null;
  revisionDiff: SupabaseQuoteRevisionDiff | null;
  revisionDetail: SupabaseQuoteRevisionDetail | null;
}) {
  const auditEntries = projectDetail?.audit_entries ?? revisionDetail?.audit_entries ?? [];
  const draft = configurationDraft?.configuration_draft ?? null;
  const config = draft?.configuration;
  return (
    <section className="panel">
      <p className="topline">Supabase revizyon akisi</p>
      {projectDetail ? (
        <>
          <h2>{projectDetail.project.name}</h2>
          <div className="timeline">
            {projectDetail.quote_revisions.map((revision) => (
              <button className="timelineItem" key={revision.id} onClick={() => onLoadRevisionDetail(revision.id)} type="button">
                <span>R{revision.revision_number}</span>
                <span className="status">{revision.status}</span>
              </button>
            ))}
          </div>
        </>
      ) : null}
      {revisionDetail ? (
        <div className="statusPanel">
          <h3>R{revisionDetail.quote_revision.revision_number} durum politikasi</h3>
          <div className="grid">
            <SummaryCard title="Durum" value={revisionDetail.status_policy.status} />
            <SummaryCard title="Degistirilebilir" value={revisionDetail.status_policy.mutable ? "Evet" : "Hayir"} />
            <SummaryCard title="Direkt durum yazimi" value={revisionDetail.status_policy.direct_status_update_allowed ? "Acik" : "Kapali"} />
          </div>
          <div className="buttonRow">
            {revisionDetail.status_policy.deferred_actions.map((action) => (
              <button disabled key={action} type="button">{action}</button>
            ))}
          </div>
        </div>
      ) : null}
      {revisionDetail ? (
        <div className="configurationDraftPanel">
          <h3>Konfigurasyon taslagi</h3>
          <div className="warningBox">
            Bu kayit yalnizca olcu ve secenek taslagidir. BOM, kenar bandi, iscilik, maliyet, vergi, toplam, PDF, onay, gonderim ve uretim paketi uretmez.
          </div>
          <form className="configurationForm" onSubmit={onSaveConfigurationDraft}>
            <input name="template_code" type="hidden" value="wardrobe" readOnly />
            <label>Genislik mm<input name="width_mm" type="number" min="100" max="6000" step="1" required defaultValue={config?.width_mm ?? 1800} /></label>
            <label>Yukseklik mm<input name="height_mm" type="number" min="100" max="4000" step="1" required defaultValue={config?.height_mm ?? 2200} /></label>
            <label>Derinlik mm<input name="depth_mm" type="number" min="100" max="2000" step="1" required defaultValue={config?.depth_mm ?? 600} /></label>
            <label>Adet<input name="quantity" type="number" min="1" max="100" step="1" required defaultValue={config?.quantity ?? 1} /></label>
            <label>Kapak<input name="door_count" type="number" min="0" max="20" step="1" required defaultValue={config?.door_count ?? 3} /></label>
            <label>Raf<input name="shelf_count" type="number" min="0" max="100" step="1" required defaultValue={config?.shelf_count ?? 4} /></label>
            <label>Malzeme SKU<input name="material_sku" defaultValue={config?.material_sku ?? "MDF-LAM-BEYAZ-18"} /></label>
            <label>Kenar bandi SKU<input name="edge_band_sku" defaultValue={config?.edge_band_sku ?? "PVC-BEYAZ-1MM"} /></label>
            <label className="wideField">Not<input name="notes" defaultValue={config?.notes ?? "Askilikli gardrop taslak konfigurasyonu"} /></label>
            <button disabled={busy || !revisionDetail.status_policy.mutable} type="submit">
              {draft ? "Konfigurasyonu guncelle" : "Konfigurasyonu kaydet"}
            </button>
          </form>
          {draft ? (
            <div className="configurationReadback">
              <span>v{draft.version}</span>
              <span>{draft.validation_status}</span>
              <span>{draft.calculation_status}</span>
              <span>{config?.width_mm} x {config?.height_mm} x {config?.depth_mm} mm</span>
              <span>{config?.quantity} adet</span>
            </div>
          ) : (
            <div className="warningBox">Bu revizyon icin Supabase konfigurasyon taslagi henuz yok.</div>
          )}
          <div className="calculationBoundary">
            <div>
              <h3>Deterministik snapshot</h3>
              <p className="smallNote">
                Hesaplama yalnizca kayitli taslak uzerinden server tarafinda yapilir. Tarayici BOM, maliyet, vergi veya toplam hesaplamaz.
              </p>
            </div>
            <div className="buttonRow">
              <button
                disabled={busy || !draft || !revisionDetail.status_policy.mutable}
                onClick={onCalculateQuoteSnapshot}
                type="button"
              >
                Kayitli taslagi hesapla
              </button>
              <button disabled type="button">PDF kapali</button>
              <button disabled type="button">Onay kapali</button>
              <button disabled type="button">Gonderim kapali</button>
              <button disabled type="button">Uretim paketi kapali</button>
            </div>
          </div>
          {quoteSnapshot ? <SupabaseQuoteSnapshotPanel snapshot={quoteSnapshot} /> : null}
          {revisionDetail ? (
            <SupabaseQuoteLifecyclePanel
              approvalGate={approvalGate}
              busy={busy}
              canPrepareApproval={canPrepareApproval}
              documentPreview={documentPreview}
              documents={documents}
              onForkRevision={onForkRevision}
              onGenerateQuoteDocument={onGenerateQuoteDocument}
              onLoadDocumentPreview={onLoadDocumentPreview}
              onLoadRevisionDiff={onLoadRevisionDiff}
              onPrepareApprovalGate={onPrepareApprovalGate}
              quoteSnapshot={quoteSnapshot}
              revisionDiff={revisionDiff}
              revisionDetail={revisionDetail}
            />
          ) : null}
        </div>
      ) : null}
      <h3>Audit zaman cizelgesi</h3>
      {auditEntries.length ? (
        <ol className="auditList">
          {auditEntries.map((entry) => (
            <li key={entry.id}>
              <span>{new Date(entry.created_at).toLocaleString("tr-TR")}</span>
              <strong>{entry.action}</strong>
              <span>{entry.target_type}</span>
              <span className="status">{entry.decision}</span>
            </li>
          ))}
        </ol>
      ) : (
        <div className="warningBox">Bu secim icin audit kaydi yok.</div>
      )}
    </section>
  );
}

function SupabaseQuoteLifecyclePanel({
  approvalGate,
  busy,
  canPrepareApproval,
  documentPreview,
  documents,
  onForkRevision,
  onGenerateQuoteDocument,
  onLoadDocumentPreview,
  onLoadRevisionDiff,
  onPrepareApprovalGate,
  quoteSnapshot,
  revisionDiff,
  revisionDetail
}: {
  approvalGate: SupabaseApprovalGate | null;
  busy: boolean;
  canPrepareApproval: boolean;
  documentPreview: SupabaseQuoteDocumentPreview | null;
  documents: SupabaseQuoteDocument[];
  onForkRevision: () => void;
  onGenerateQuoteDocument: () => void;
  onLoadDocumentPreview: (documentId: string) => void;
  onLoadRevisionDiff: () => void;
  onPrepareApprovalGate: () => void;
  quoteSnapshot: SupabaseQuoteSnapshotResponse | null;
  revisionDiff: SupabaseQuoteRevisionDiff | null;
  revisionDetail: SupabaseQuoteRevisionDetail;
}) {
  const hasCalculatedSnapshot = quoteSnapshot?.calculation_status === "calculated" && Boolean(quoteSnapshot.cost_snapshot);
  const latestDocument = documents[0] ?? null;
  const canPreview = Boolean(latestDocument);
  return (
    <div className="lifecyclePanel">
      <div className="lifecycleHeader">
        <div>
          <h3>Frozen teklif yasam dongusu</h3>
          <p className="smallNote">Belge, revizyon farki ve onay kapisi kayitli snapshot verisinden server tarafinda uretilir.</p>
        </div>
        <span className="status">R{revisionDetail.quote_revision.revision_number}</span>
      </div>

      <div className="grid">
        <SummaryCard title="Belgeler" value={`${documents.length} kayit`} />
        <SummaryCard title="Son belge" value={latestDocument ? latestDocument.sha256.slice(0, 12) : "-"} />
        <SummaryCard title="Onay kapisi" value={approvalGate?.status ?? "not_prepared"} />
      </div>

      <div className="buttonRow">
        <button disabled={busy || !hasCalculatedSnapshot} onClick={onGenerateQuoteDocument} type="button">
          HTML belgeyi dondur
        </button>
        <button disabled={busy || !canPreview} onClick={() => latestDocument ? onLoadDocumentPreview(latestDocument.id) : undefined} type="button">
          Son belgeyi ac
        </button>
        <button disabled={busy} onClick={onForkRevision} type="button">
          Revizyon catalla
        </button>
        <button disabled={busy} onClick={onLoadRevisionDiff} type="button">
          Farklari goster
        </button>
        <button disabled={busy || !canPrepareApproval || !canPreview} onClick={onPrepareApprovalGate} type="button">
          Onay kapisi hazirla
        </button>
        <button disabled type="button">Teklifi gonder</button>
        <button disabled type="button">Uretim paketi</button>
      </div>

      {documents.length ? (
        <table className="table">
          <thead><tr><th>Belge</th><th>Snapshot</th><th>Surum</th><th>Boyut</th><th></th></tr></thead>
          <tbody>
            {documents.map((doc) => (
              <tr key={doc.id}>
                <td>{doc.sha256.slice(0, 12)}</td>
                <td>{doc.snapshot_hash?.slice(0, 12) ?? "-"}</td>
                <td>{doc.document_version}</td>
                <td>{doc.size_bytes}</td>
                <td><button disabled={busy} onClick={() => onLoadDocumentPreview(doc.id)} type="button">Ac</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="warningBox">Bu revizyon icin frozen teklif belgesi henuz yok.</div>
      )}

      {documentPreview ? (
        <div className="documentPreviewPanel">
          <div className="configurationReadback">
            <span>{documentPreview.document_version}</span>
            <span>{documentPreview.provenance.storage}</span>
            <span>PDF {documentPreview.provenance.pdf_status}</span>
            <span>{documentPreview.sha256.slice(0, 12)}</span>
          </div>
          <iframe className="quoteFrame" sandbox="" srcDoc={documentPreview.html} title="Supabase frozen teklif belgesi" />
        </div>
      ) : null}

      {revisionDiff ? (
        <div className="diffPanel">
          <div className="configurationReadback">
            <span>{revisionDiff.source}</span>
            <span>{revisionDiff.diff_version}</span>
            <span>R{revisionDiff.left_revision.revision_number} {"->"} R{revisionDiff.right_revision.revision_number}</span>
          </div>
          <table className="table">
            <thead><tr><th>Kategori</th><th>Alan</th><th>Once</th><th>Sonra</th></tr></thead>
            <tbody>
              {revisionDiff.entries.map((entry) => (
                <tr key={`${entry.category}-${entry.field}`}>
                  <td>{entry.category}</td>
                  <td>{entry.field}</td>
                  <td>{entry.before}</td>
                  <td>{entry.after}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {approvalGate ? (
        <div className="approvalBox">
          <strong>{approvalGate.status}</strong>
          <p>
            Belge {approvalGate.generated_document_id ? approvalGate.generated_document_id.slice(0, 8) : "-"} /
            snapshot {approvalGate.snapshot_hash ? approvalGate.snapshot_hash.slice(0, 12) : "-"} /
            token secret returned: {String(approvalGate.token_secret_returned)}
          </p>
          <p className="smallNote">{approvalGate.expires_at ? new Date(approvalGate.expires_at).toLocaleString("tr-TR") : "Hazir degil"}</p>
        </div>
      ) : null}
    </div>
  );
}

function SupabaseQuoteSnapshotPanel({ snapshot }: { snapshot: SupabaseQuoteSnapshotResponse }) {
  if (snapshot.calculation_status !== "calculated" || !snapshot.bom_snapshot || !snapshot.cost_snapshot) {
    return <div className="warningBox">Bu revizyon icin deterministik snapshot henuz yok.</div>;
  }
  return (
    <div className="snapshotPanel">
      <div className="grid">
        <SummaryCard title="BOM" value={`${snapshot.bom_snapshot.part_count} parca satiri`} />
        <SummaryCard title="Kenar bandi" value={`${snapshot.bom_snapshot.edge_count} kenar satiri`} />
        <SummaryCard title="Formul" value={snapshot.cost_snapshot.formula_version} />
        <SummaryCard title="Ara toplam" value={money(snapshot.cost_snapshot.subtotal_minor, snapshot.cost_snapshot.currency)} />
        <SummaryCard title="Markup" value={money(snapshot.cost_snapshot.markup_minor, snapshot.cost_snapshot.currency)} />
        <SummaryCard title="Genel toplam" value={money(snapshot.cost_snapshot.grand_total_minor, snapshot.cost_snapshot.currency)} />
      </div>
      <div className="splitTables">
        <div>
          <h3>BOM snapshot</h3>
          <table className="table">
            <tbody>
              {snapshot.bom_snapshot.parts.map((part) => (
                <tr key={part.code}>
                  <td>{part.code}</td>
                  <td>{part.name}</td>
                  <td>{part.width_mm} x {part.height_mm} mm</td>
                  <td>{part.quantity} adet</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h3>Kenar bandi snapshot</h3>
          <table className="table">
            <tbody>
              {snapshot.bom_snapshot.edges.map((edge) => (
                <tr key={`${edge.part_code}-${edge.edge}`}>
                  <td>{edge.part_code}</td>
                  <td>{edge.edge}</td>
                  <td>{edge.billable_mm} mm</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="splitTables">
        <div>
          <h3>Maliyet snapshot</h3>
          <table className="table">
            <tbody>
              {snapshot.cost_snapshot.categories.map((category) => (
                <tr key={category.category}>
                  <td>{category.category}</td>
                  <td>{money(category.amount_minor, category.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h3>Iscilik snapshot</h3>
          <table className="table">
            <tbody>
              {snapshot.cost_snapshot.labor.map((labor) => (
                <tr key={labor.code}>
                  <td>{labor.name}</td>
                  <td>{labor.labor_type}</td>
                  <td>{labor.quantity}</td>
                  <td>{money(labor.total_minor, labor.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="configurationReadback">
        <span>{snapshot.cost_snapshot.provenance.source}</span>
        <span>{snapshot.cost_snapshot.provenance.calculation_version}</span>
        <span>BOM hash {snapshot.bom_snapshot.snapshot_hash.slice(0, 12)}</span>
        <span>Cost hash {snapshot.cost_snapshot.snapshot_hash.slice(0, 12)}</span>
      </div>
      <div className="warningBox">
        {snapshot.cost_snapshot.provenance.limitations.join(" ")}
      </div>
    </div>
  );
}

function SupabaseMutationPanel({
  busy,
  onCreateCustomer,
  onCreateProject,
  onCreateQuoteDraft,
  overview
}: {
  busy: boolean;
  onCreateCustomer: (event: FormEvent<HTMLFormElement>) => void;
  onCreateProject: (event: FormEvent<HTMLFormElement>) => void;
  onCreateQuoteDraft: (event: FormEvent<HTMLFormElement>) => void;
  overview: SupabaseDemoOverview;
}) {
  return (
    <section className="panel">
      <p className="topline">Supabase yazma siniri</p>
      <h2>Guvenli taslak mutasyonlari</h2>
      <div className="warningBox">
        Bu bolum yalnizca oturum kapsamli musteri, proje ve teklif taslagi kaydeder. Hesaplama, onay, gonderim, PDF ve uretim paketi devre disidir.
      </div>
      <div className="splitTables">
        <form onSubmit={onCreateCustomer}>
          <h3>Musteri olustur</h3>
          <label>Ad<input name="name" required defaultValue="Supabase Musteri" /></label>
          <label>E-posta<input name="email" defaultValue="supabase-musteri@example.local" /></label>
          <label>Telefon<input name="phone" defaultValue="+90 555 222 33 44" /></label>
          <button disabled={busy} type="submit">Musteri taslagi kaydet</button>
        </form>
        <form onSubmit={onCreateProject}>
          <h3>Proje olustur</h3>
          <label>
            Musteri
            <select name="customer_id" required defaultValue={overview.customers[0]?.id ?? ""}>
              {overview.customers.map((customer) => (
                <option key={customer.id} value={customer.id}>{customer.name}</option>
              ))}
            </select>
          </label>
          <label>Proje adi<input name="name" required defaultValue="Supabase Proje" /></label>
          <button disabled={busy || overview.customers.length === 0} type="submit">Proje taslagi kaydet</button>
        </form>
      </div>
      <form onSubmit={onCreateQuoteDraft}>
        <h3>Teklif taslagi olustur</h3>
        <label>
          Proje
          <select name="project_id" required defaultValue={overview.projects[0]?.id ?? ""}>
            {overview.projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
        </label>
        <div className="buttonRow">
          <button disabled={busy || overview.projects.length === 0} type="submit">Teklif taslagi olustur</button>
          <button disabled type="button">Teklifi gonder</button>
          <button disabled type="button">Onayla</button>
          <button disabled type="button">PDF uret</button>
          <button disabled type="button">Uretim paketi</button>
          <button disabled type="button">Ajan calistir</button>
        </div>
      </form>
    </section>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return <article className="card"><h2>{title}</h2><p>{value}</p></article>;
}

function ResultTables({ revision }: { revision: QuoteRevision }) {
  return (
    <div className="section">
      <h3>BOM</h3>
      <table className="table"><tbody>{revision.bom.map((part) => <tr key={part.code}><td>{part.code}</td><td>{part.name}</td><td>{part.width_mm} x {part.height_mm} mm</td><td>{part.quantity}</td></tr>)}</tbody></table>
      <h3>Kenar bandi</h3>
      <table className="table"><tbody>{revision.edges.map((edge) => <tr key={`${edge.part_code}-${edge.edge}`}><td>{edge.part_code}</td><td>{edge.edge}</td><td>{edge.billable_mm} mm</td></tr>)}</tbody></table>
      <h3>Maliyet kirilimi</h3>
      <table className="table"><tbody>{revision.cost.categories.map((category) => <tr key={category.category}><td>{category.category}</td><td>{money(category.amount.amount_minor)}</td></tr>)}</tbody></table>
    </div>
  );
}

function money(amountMinor: number, currency = "TRY") {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency }).format(amountMinor / 100);
}

function renderFactValue(value: unknown) {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  return JSON.stringify(value);
}
