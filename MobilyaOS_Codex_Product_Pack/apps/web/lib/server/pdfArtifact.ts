import type {
  PersistedCostSnapshotRecord,
  QuoteDocumentArtifactRecord,
  QuoteRevisionRecord
} from "./supabaseRepository";

export const quotePdfArtifactVersion = "quote-pdf-v1.0.0";
export const quotePdfRendererVersion = "mobilyaos-deterministic-pdf-writer-v1.0.0";
export const quotePdfContentType = "application/pdf";

export type DeterministicQuotePdfBuild = {
  bytes: Uint8Array;
  contentType: typeof quotePdfContentType;
  artifactVersion: typeof quotePdfArtifactVersion;
  rendererVersion: typeof quotePdfRendererVersion;
  sizeBytes: number;
};

function escapePdfText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function ascii(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "?");
}

function formatMoneyMinor(amountMinor: number, currency: string): string {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new Error("PDF money amount is outside the safe integer range.");
  }
  const sign = amountMinor < 0 ? "-" : "";
  const absolute = Math.abs(amountMinor);
  const whole = Math.floor(absolute / 100);
  const cents = String(absolute % 100).padStart(2, "0");
  return `${sign}${whole}.${cents} ${ascii(currency || "TRY")}`;
}

function pdfTextLine(line: string, first: boolean): string {
  const escaped = escapePdfText(ascii(line).slice(0, 110));
  return first ? `50 790 Td (${escaped}) Tj` : `0 -18 Td (${escaped}) Tj`;
}

function pdfObject(id: number, body: string): string {
  return `${id} 0 obj\n${body}\nendobj\n`;
}

export function buildDeterministicQuotePdfArtifact(input: {
  revision: QuoteRevisionRecord;
  document: QuoteDocumentArtifactRecord;
  costSnapshot: PersistedCostSnapshotRecord;
}): DeterministicQuotePdfBuild {
  const lines = [
    "MobilyaOS Quote PDF",
    `PDF artifact version: ${quotePdfArtifactVersion}`,
    `Renderer version: ${quotePdfRendererVersion}`,
    `Quote revision: R${input.revision.revision_number}`,
    `Quote status: ${input.revision.status}`,
    `Frozen document version: ${input.document.document_version}`,
    `Calculation version: ${input.costSnapshot.formula_version}`,
    `Cost snapshot hash: ${input.costSnapshot.snapshot_hash}`,
    `Source document hash: ${input.document.sha256}`,
    `Subtotal: ${formatMoneyMinor(input.costSnapshot.subtotal_minor, input.costSnapshot.currency)}`,
    `Markup: ${formatMoneyMinor(input.costSnapshot.markup_minor, input.costSnapshot.currency)}`,
    `VAT: ${formatMoneyMinor(input.costSnapshot.vat_minor, input.costSnapshot.currency)}`,
    `Grand total: ${formatMoneyMinor(input.costSnapshot.grand_total_minor, input.costSnapshot.currency)}`,
    "Authoritative totals come from the persisted cost snapshot.",
    "External delivery and production package remain deferred."
  ];
  const contentStream = [
    "BT",
    "/F1 15 Tf",
    ...lines.map((line, index) => pdfTextLine(line, index === 0)),
    "ET"
  ].join("\n");

  const objects = [
    pdfObject(1, "<< /Type /Catalog /Pages 2 0 R >>"),
    pdfObject(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    pdfObject(
      3,
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>"
    ),
    pdfObject(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"),
    pdfObject(5, `<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`)
  ];
  let output = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(output.length);
    output += object;
  }
  const xrefOffset = output.length;
  output += `xref\n0 ${objects.length + 1}\n`;
  output += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) {
    output += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  const bytes = new TextEncoder().encode(output);
  return {
    bytes,
    contentType: quotePdfContentType,
    artifactVersion: quotePdfArtifactVersion,
    rendererVersion: quotePdfRendererVersion,
    sizeBytes: bytes.byteLength
  };
}
