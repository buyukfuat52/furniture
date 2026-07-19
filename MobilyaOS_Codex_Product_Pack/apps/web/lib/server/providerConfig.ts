export type ProviderStatus = "provider_missing" | "provider_configured_unverified" | "sandbox_provider_available";

export type ProviderAdapter = "disabled_provider_adapter_v1" | "sandbox_provider_adapter_v1";

export type ProviderConfigVersion = "provider-config-boundary-v1.0.0" | "sandbox-provider-config-v1.0.0";

export type ProviderAdapterVersion = "disabled-provider-adapter-v1.0.0" | "sandbox-provider-adapter-v1.0.0";

export type QuoteProviderStatusRecord = {
  provider_status: ProviderStatus;
  provider_adapter: ProviderAdapter;
  provider_configured: boolean;
  email_provider_configured: false;
  real_delivery_enabled: false;
  sandbox_delivery_enabled: boolean;
  sandbox_delivery_verified: boolean;
  sent_transition_enabled: false;
  provider_acknowledgement_required: true;
  provider_acknowledgement_verified: boolean;
  sandbox_acknowledgement_verified: boolean;
  provider_secret_returned: false;
  provider_raw_payload_returned: false;
  provider_message_id_available: false;
  provider_config_version: ProviderConfigVersion;
  adapter_version: ProviderAdapterVersion;
  blocked_reason: "provider_missing" | "provider_not_verified" | "real_provider_deferred";
  deferred_actions: string[];
};

const providerConfigSignalKeys = [
  "QUOTE_EMAIL_PROVIDER",
  "EMAIL_PROVIDER",
  "SENDGRID_API_KEY",
  "RESEND_API_KEY",
  "MAILGUN_API_KEY",
  "POSTMARK_SERVER_TOKEN",
  "SMTP_HOST",
  "SMTP_PASSWORD"
] as const;

function hasConfiguredProviderSignal(): boolean {
  return providerConfigSignalKeys.some((key) => Boolean(process.env[key]?.trim()));
}

export function getQuoteProviderStatus(): QuoteProviderStatusRecord {
  const providerConfigured = hasConfiguredProviderSignal();
  return {
    provider_status: "sandbox_provider_available",
    provider_adapter: "sandbox_provider_adapter_v1",
    provider_configured: providerConfigured,
    email_provider_configured: false,
    sandbox_delivery_enabled: true,
    sandbox_delivery_verified: false,
    real_delivery_enabled: false,
    sent_transition_enabled: false,
    provider_acknowledgement_required: true,
    sandbox_acknowledgement_verified: false,
    provider_acknowledgement_verified: false,
    provider_secret_returned: false,
    provider_raw_payload_returned: false,
    provider_message_id_available: false,
    provider_config_version: "sandbox-provider-config-v1.0.0",
    adapter_version: "sandbox-provider-adapter-v1.0.0",
    blocked_reason: providerConfigured ? "provider_not_verified" : "real_provider_deferred",
    deferred_actions: [
      "quote_send_real_provider_delivery",
      "quote_sent_transition",
      "production_package"
    ]
  };
}
