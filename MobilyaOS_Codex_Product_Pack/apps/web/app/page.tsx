"use client";

import { FormEvent, MouseEvent, useEffect, useMemo, useState } from "react";
import {
  AgentChatResponse,
  apiBaseUrl,
  ApiError,
  computeBaseUrl,
  Customer,
  DiffResponse,
  QuoteDocument,
  QuoteRevision,
  SupabaseDemoLoginResponse,
  SupabaseDemoOverview,
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
      const response = await fetch(`${computeBaseUrl}/api/v1/agent/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          message: chatInput,
          context: {
            company_id: "00000000-0000-0000-0000-000000000001",
            user_id: "demo-sales-user",
            roles: ["sales"],
            project_id: projectId || undefined,
            revision_id: revision?.id,
            left_revision_id: revision?.id,
            right_revision_id: forkedRevision?.id,
            cost_snapshot: revision?.cost,
            diff_entries: diff?.entries ?? []
          }
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

        {cloudData ? <SupabaseOverview overview={cloudData} /> : null}

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

function SupabaseOverview({ overview }: { overview: SupabaseDemoOverview }) {
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

function money(amountMinor: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(amountMinor / 100);
}

function renderFactValue(value: unknown) {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  return JSON.stringify(value);
}
