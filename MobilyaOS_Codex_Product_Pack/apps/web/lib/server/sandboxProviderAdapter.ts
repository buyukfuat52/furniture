import { createHash } from "node:crypto";

export const sandboxProviderAdapter = "sandbox_provider_adapter_v1" as const;
export const sandboxProviderConfigVersion = "sandbox-provider-config-v1.0.0" as const;
export const sandboxProviderAdapterVersion = "sandbox-provider-adapter-v1.0.0" as const;
export const sandboxAcknowledgementVersion = "sandbox-acknowledgement-v1.0.0" as const;

function hashText(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function buildSandboxAcknowledgementHash(input: {
  companyId: string;
  quoteRevisionId: string;
  deliveryAttemptId: string;
  sendIntentId: string;
  deliveryOutboxId: string;
  pdfArtifactId: string;
  generatedDocumentId: string;
  providerConfigVersion: string;
  adapterVersion: string;
}): string {
  return hashText([
    "sandbox-provider-acknowledgement-v1",
    input.companyId,
    input.quoteRevisionId,
    input.deliveryAttemptId,
    input.sendIntentId,
    input.deliveryOutboxId,
    input.pdfArtifactId,
    input.generatedDocumentId,
    input.providerConfigVersion,
    input.adapterVersion
  ].join("|"));
}
