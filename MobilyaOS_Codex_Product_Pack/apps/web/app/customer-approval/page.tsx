"use client";

import { FormEvent, useState } from "react";
import type { SupabaseApprovalConsumption } from "../../lib/api";

type ApprovalResult = {
  approval_consumption: SupabaseApprovalConsumption;
};

async function consumeApprovalCode(approvalCode: string): Promise<ApprovalResult> {
  const response = await fetch("/api/supabase/approval-tokens/consume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approval_token: approvalCode })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok && !payload.approval_consumption) {
    throw new Error("Onay kodu kabul edilemedi.");
  }
  return payload as ApprovalResult;
}

export default function CustomerApprovalPage() {
  const [approvalCode, setApprovalCode] = useState("");
  const [result, setResult] = useState<SupabaseApprovalConsumption | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submitApproval(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = approvalCode.trim();
    if (!code) {
      setError("Onay kodu gerekli.");
      return;
    }
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const payload = await consumeApprovalCode(code);
      setApprovalCode("");
      setResult(payload.approval_consumption);
    } catch (caught) {
      setApprovalCode("");
      setError(caught instanceof Error ? caught.message : "Onay kodu kabul edilemedi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="pageShell approvalPage">
      <section className="approvalHero">
        <div>
          <p className="eyebrow">MobilyaOS musteri onayi</p>
          <h1>Teklif onay kodu</h1>
          <p className="smallNote">
            Size iletilen kodu girerek teklif onay sonucunu kaydedin.
          </p>
        </div>
      </section>

      <section className="approvalFormPanel">
        <form className="formGrid" onSubmit={submitApproval}>
          <label>
            Onay kodu
            <input
              autoComplete="one-time-code"
              onChange={(event) => setApprovalCode(event.target.value)}
              type="password"
              value={approvalCode}
            />
          </label>
          <button disabled={busy} type="submit">{busy ? "Kontrol ediliyor" : "Onayi tamamla"}</button>
        </form>

        {error ? <div className="warningBox">{error}</div> : null}

        {result ? (
          <div className="approvalResult">
            <strong>{result.status === "approved" ? "Teklif onaylandi" : "Onay tamamlanamadi"}</strong>
            <p>
              Teklif durumu: {result.quote_status_changed ? "onaylandi" : "degismedi"}
            </p>
            <p className="smallNote">
              Gonderim: {result.quote_send_triggered ? "calisti" : "calismadi"} /
              uretim paketi: {result.production_package_triggered ? "calisti" : "calismadi"}
            </p>
            <p className="smallNote">
              Bekleyen adimlar: {result.deferred_actions.join(", ") || "yok"}
            </p>
          </div>
        ) : null}
      </section>
    </main>
  );
}
