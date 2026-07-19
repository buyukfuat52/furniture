export type ProviderStatus = "provider_missing" | "provider_configured_unverified";

export type QuoteProviderStatusRecord = {
  provider_status: ProviderStatus;
  provider_adapter: "disabled_provider_adapter_v1";
  provider_configured: boolean;
  email_provider_configured: false;
  real_delivery_enabled: false;
  sent_transition_enabled: false;
  provider_acknowledgement_required: true;
  provider_acknowledgement_verified: false;
  provider_secret_returned: false;
  provider_raw_payload_returned: false;
  provider_message_id_available: false;
  provider_config_version: "provider-config-boundary-v1.0.0";
  adapter_version: "disabled-provider-adapter-v1.0.0";
  blocked_reason: "provider_missing" | "provider_not_verified";
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
    provider_status: providerConfigured ? "provider_configured_unverified" : "provider_missing",
    provider_adapter: "disabled_provider_adapter_v1",
    provider_configured: providerConfigured,
    email_provider_configured: false,
    real_delivery_enabled: false,
    sent_transition_enabled: false,
    provider_acknowledgement_required: true,
    provider_acknowledgement_verified: false,
    provider_secret_returned: false,
    provider_raw_payload_returned: false,
    provider_message_id_available: false,
    provider_config_version: "provider-config-boundary-v1.0.0",
    adapter_version: "disabled-provider-adapter-v1.0.0",
    blocked_reason: providerConfigured ? "provider_not_verified" : "provider_missing",
    deferred_actions: [
      "quote_send_external_delivery",
      "quote_sent_transition",
      "production_package"
    ]
  };
}
