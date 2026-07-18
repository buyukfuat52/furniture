import { createHash, randomBytes } from "node:crypto";
import type {
  ProjectRecord,
  QuoteConfigurationDraftRecord,
  QuoteRevisionRecord,
  QuoteSnapshotResponse
} from "./supabaseRepository";

export const quoteDocumentVersion = "quote-html-v1.0.0";
export const approvalTokenVersion = "approval-token-v1.0.0";

export type FrozenQuoteDocumentBuild = {
  documentVersion: string;
  contentType: "text/html; charset=utf-8";
  html: string;
  sha256: string;
  sizeBytes: number;
};

export type ApprovalTokenSecret = {
  tokenHash: string;
  version: string;
};

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function hashApprovalTokenSecret(rawToken: string): string {
  return sha256(rawToken);
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function integerText(value: unknown): string {
  return typeof value === "number" && Number.isSafeInteger(value) ? String(value) : "0";
}

function moneyMinor(value: unknown, currency: unknown): string {
  const amount = typeof value === "number" && Number.isSafeInteger(value) ? value : 0;
  const safeCurrency = typeof currency === "string" && /^[A-Z]{3}$/.test(currency) ? currency : "";
  const sign = amount < 0 ? "-" : "";
  const absolute = Math.abs(amount);
  const whole = Math.floor(absolute / 100);
  const cents = String(absolute % 100).padStart(2, "0");
  return `${sign}${whole}.${cents} ${safeCurrency}`.trim();
}

function tableRows(rows: string[]): string {
  return rows.join("");
}

export function buildFrozenQuoteHtmlDocument(input: {
  project: ProjectRecord;
  snapshot: QuoteSnapshotResponse;
}): FrozenQuoteDocumentBuild {
  const { snapshot, project } = input;
  if (snapshot.calculation_status !== "calculated" || !snapshot.bom_snapshot || !snapshot.cost_snapshot || !snapshot.configuration_draft) {
    throw new Error("trusted snapshot is required for document generation.");
  }

  const revision = snapshot.quote_revision;
  const config = snapshot.configuration_draft.configuration;
  const cost = snapshot.cost_snapshot;
  const bom = snapshot.bom_snapshot;
  const partRows = tableRows(bom.parts.map((part) => `
    <tr>
      <td>${escapeHtml(part.code)}</td>
      <td>${escapeHtml(part.name)}</td>
      <td>${integerText(part.width_mm)} x ${integerText(part.height_mm)}</td>
      <td>${integerText(part.quantity)}</td>
    </tr>`));
  const edgeRows = tableRows(bom.edges.map((edge) => `
    <tr>
      <td>${escapeHtml(edge.part_code)}</td>
      <td>${escapeHtml(edge.edge)}</td>
      <td>${integerText(edge.billable_mm)}</td>
    </tr>`));
  const costRows = tableRows(cost.categories.map((category) => `
    <tr>
      <td>${escapeHtml(category.category)}</td>
      <td>${escapeHtml(moneyMinor(category.amount_minor, category.currency))}</td>
    </tr>`));
  const laborRows = tableRows(cost.labor.map((labor) => `
    <tr>
      <td>${escapeHtml(labor.name)}</td>
      <td>${escapeHtml(labor.labor_type)}</td>
      <td>${integerText(labor.quantity)}</td>
      <td>${escapeHtml(moneyMinor(labor.total_minor, labor.currency))}</td>
    </tr>`));
  const html = `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>MobilyaOS Frozen Quote ${escapeHtml(revision.revision_number)}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #17202a; margin: 32px; }
    h1, h2 { margin: 0 0 12px; }
    section { margin-top: 24px; }
    table { border-collapse: collapse; width: 100%; margin-top: 8px; }
    th, td { border: 1px solid #d8dee9; padding: 8px; text-align: left; }
    th { background: #f3f6fa; }
    .meta { color: #4d5d6c; font-size: 13px; }
    .total { font-size: 20px; font-weight: 700; }
  </style>
</head>
<body>
  <h1>MobilyaOS Frozen Quote</h1>
  <p class="meta">Document version ${quoteDocumentVersion}</p>
  <section>
    <h2>Project</h2>
    <p>${escapeHtml(project.name)} / ${escapeHtml(project.customer_name)}</p>
    <p>Revision R${revision.revision_number} (${escapeHtml(revision.status)})</p>
  </section>
  <section>
    <h2>Configuration</h2>
    <p>${escapeHtml(config.template_code)} - ${integerText(config.width_mm)} x ${integerText(config.height_mm)} x ${integerText(config.depth_mm)} mm - quantity ${integerText(config.quantity)}</p>
    <p>Material ${escapeHtml(config.material_sku)} / edge band ${escapeHtml(config.edge_band_sku)}</p>
  </section>
  <section>
    <h2>BOM</h2>
    <table><thead><tr><th>Code</th><th>Name</th><th>Size mm</th><th>Qty</th></tr></thead><tbody>${partRows}</tbody></table>
  </section>
  <section>
    <h2>Edge Banding</h2>
    <table><thead><tr><th>Part</th><th>Edge</th><th>Billable mm</th></tr></thead><tbody>${edgeRows}</tbody></table>
  </section>
  <section>
    <h2>Labor</h2>
    <table><thead><tr><th>Name</th><th>Type</th><th>Qty</th><th>Total</th></tr></thead><tbody>${laborRows}</tbody></table>
  </section>
  <section>
    <h2>Cost Snapshot</h2>
    <table><thead><tr><th>Category</th><th>Amount</th></tr></thead><tbody>${costRows}</tbody></table>
    <p>Subtotal ${escapeHtml(moneyMinor(cost.subtotal_minor, cost.currency))}</p>
    <p>Markup ${escapeHtml(moneyMinor(cost.markup_minor, cost.currency))}</p>
    <p>VAT ${escapeHtml(moneyMinor(cost.vat_minor, cost.currency))}</p>
    <p class="total">Grand total ${escapeHtml(moneyMinor(cost.grand_total_minor, cost.currency))}</p>
  </section>
  <section>
    <h2>Provenance</h2>
    <p class="meta">Calculation ${escapeHtml(cost.formula_version)} / source ${escapeHtml(cost.provenance.source)}</p>
    <p class="meta">BOM hash ${escapeHtml(bom.snapshot_hash)}</p>
    <p class="meta">Cost hash ${escapeHtml(cost.snapshot_hash)}</p>
  </section>
</body>
</html>`;
  return {
    documentVersion: quoteDocumentVersion,
    contentType: "text/html; charset=utf-8",
    html,
    sha256: sha256(html),
    sizeBytes: Buffer.byteLength(html, "utf8")
  };
}

export function buildApprovalTokenSecret(): ApprovalTokenSecret {
  const rawToken = randomBytes(32).toString("base64url");
  return {
    tokenHash: sha256(rawToken),
    version: approvalTokenVersion
  };
}

export function diffValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "missing";
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return String(value);
}

export function configurationDiffEntries(
  left: QuoteConfigurationDraftRecord | null,
  right: QuoteConfigurationDraftRecord | null
): Array<{ category: string; field: string; before: string; after: string }> {
  const fields: Array<keyof QuoteConfigurationDraftRecord["configuration"]> = [
    "template_code",
    "width_mm",
    "height_mm",
    "depth_mm",
    "quantity",
    "door_count",
    "shelf_count",
    "material_sku",
    "edge_band_sku",
    "notes"
  ];
  return fields.flatMap((field) => {
    const before = left ? left.configuration[field] : null;
    const after = right ? right.configuration[field] : null;
    return diffValue(before) === diffValue(after)
      ? []
      : [{ category: "configuration", field, before: diffValue(before), after: diffValue(after) }];
  });
}

export function revisionDiffEntries(
  left: QuoteRevisionRecord,
  right: QuoteRevisionRecord
): Array<{ category: string; field: string; before: string; after: string }> {
  const fields: Array<keyof QuoteRevisionRecord> = ["status", "version", "parent_revision_id"];
  return fields.flatMap((field) => {
    const before = left[field];
    const after = right[field];
    return diffValue(before) === diffValue(after)
      ? []
      : [{ category: "revision", field, before: diffValue(before), after: diffValue(after) }];
  });
}
