import { getRealProviderReadiness, realProviderAdapter, realProviderAdapterVersion, realProviderConfigVersion } from "./realProviderBoundary";

export type ProviderStatus = "provider_missing" | "provider_configured_unverified" | "sandbox_provider_available";

export type ProviderAdapter = "disabled_provider_adapter_v1" | "sandbox_provider_adapter_v1" | "real_provider_adapter_v1";

export type ProviderConfigVersion =
  | "provider-config-boundary-v1.0.0"
  | "sandbox-provider-config-v1.0.0"
  | "real-provider-config-boundary-v1.0.0";

export type ProviderAdapterVersion =
  | "disabled-provider-adapter-v1.0.0"
  | "sandbox-provider-adapter-v1.0.0"
  | "real-provider-adapter-v1.0.0";

export type QuoteProviderStatusRecord = {
  provider_mode: "sandbox_only" | "real_configured_disabled" | "real_configured_invalid";
  provider_status: ProviderStatus;
  provider_adapter: ProviderAdapter;
  provider_configured: boolean;
  real_provider_configured: boolean;
  real_provider_config_valid: boolean;
  real_provider_enable_requested: boolean;
  real_provider_adapter_available: boolean;
  email_provider_configured: false;
  real_delivery_enabled: false;
  sandbox_delivery_enabled: boolean;
  sandbox_delivery_verified: boolean;
  sent_transition_enabled: false;
  real_sent_transition_enabled: false;
  provider_acknowledgement_required: true;
  provider_acknowledgement_verified: boolean;
  real_provider_acknowledgement_enabled: false;
  real_provider_acknowledgement_verified: false;
  sandbox_acknowledgement_verified: boolean;
  webhook_configured: boolean;
  webhook_enable_requested: boolean;
  webhook_signature_verification_ready: boolean;
  webhook_consumption_enabled: false;
  provider_secret_returned: false;
  provider_raw_payload_returned: false;
  webhook_secret_returned: false;
  webhook_signature_returned: false;
  provider_message_id_available: false;
  provider_config_version: ProviderConfigVersion;
  adapter_version: ProviderAdapterVersion;
  blocked_reason:
    | "provider_missing"
    | "provider_not_verified"
    | "real_provider_deferred"
    | "real_provider_missing"
    | "real_provider_incomplete"
    | "real_provider_invalid_format"
    | "real_delivery_enable_flag_missing"
    | "webhook_signature_required"
    | "real_sent_transition_deferred";
  deferred_actions: string[];
};

export function getQuoteProviderStatus(): QuoteProviderStatusRecord {
  const realProvider = getRealProviderReadiness();
  const providerConfigured = realProvider.real_provider_configured;
  const realProviderSelected = realProvider.real_provider_configured;
  return {
    provider_mode: realProvider.provider_mode,
    provider_status: realProviderSelected ? "provider_configured_unverified" : "sandbox_provider_available",
    provider_adapter: realProviderSelected ? realProviderAdapter : "sandbox_provider_adapter_v1",
    provider_configured: providerConfigured,
    real_provider_configured: realProvider.real_provider_configured,
    real_provider_config_valid: realProvider.real_provider_config_valid,
    real_provider_enable_requested: realProvider.real_delivery_enable_requested,
    real_provider_adapter_available: realProvider.real_provider_adapter_available,
    email_provider_configured: false,
    sandbox_delivery_enabled: true,
    sandbox_delivery_verified: false,
    real_delivery_enabled: false,
    sent_transition_enabled: false,
    real_sent_transition_enabled: false,
    provider_acknowledgement_required: true,
    sandbox_acknowledgement_verified: false,
    provider_acknowledgement_verified: false,
    real_provider_acknowledgement_enabled: false,
    real_provider_acknowledgement_verified: false,
    webhook_configured: realProvider.webhook_configured,
    webhook_enable_requested: realProvider.webhook_enable_requested,
    webhook_signature_verification_ready: realProvider.webhook_signature_verification_ready,
    webhook_consumption_enabled: false,
    provider_secret_returned: false,
    provider_raw_payload_returned: false,
    webhook_secret_returned: false,
    webhook_signature_returned: false,
    provider_message_id_available: false,
    provider_config_version: realProviderSelected ? realProviderConfigVersion : "sandbox-provider-config-v1.0.0",
    adapter_version: realProviderSelected ? realProviderAdapterVersion : "sandbox-provider-adapter-v1.0.0",
    blocked_reason: providerConfigured ? realProvider.blocked_reason : "real_provider_deferred",
    deferred_actions: [
      "quote_send_real_provider_delivery",
      "real_provider_webhook_consumption",
      "real_provider_acknowledgement",
      "quote_sent_transition",
      "production_package"
    ]
  };
}
