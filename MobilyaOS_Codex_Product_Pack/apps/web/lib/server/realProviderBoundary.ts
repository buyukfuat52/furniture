export const realProviderAdapter = "real_provider_adapter_v1";
export const realProviderConfigVersion = "real-provider-config-boundary-v1.0.0";
export const realProviderAdapterVersion = "real-provider-adapter-v1.0.0";

const providerNameKeys = ["QUOTE_EMAIL_PROVIDER", "EMAIL_PROVIDER"] as const;
const providerSecretKeys = [
  "QUOTE_EMAIL_PROVIDER_API_KEY",
  "EMAIL_PROVIDER_SECRET",
  "SENDGRID_API_KEY",
  "RESEND_API_KEY",
  "MAILGUN_API_KEY",
  "POSTMARK_SERVER_TOKEN",
  "SMTP_PASSWORD"
] as const;
const webhookSecretKeys = ["QUOTE_PROVIDER_WEBHOOK_SECRET", "EMAIL_PROVIDER_WEBHOOK_SECRET"] as const;
const providerSignalKeys = [
  ...providerNameKeys,
  ...providerSecretKeys,
  "SMTP_HOST",
  "SMTP_PORT",
  "QUOTE_REAL_PROVIDER_DELIVERY_ENABLED",
  "QUOTE_PROVIDER_WEBHOOKS_ENABLED",
  ...webhookSecretKeys
] as const;

const supportedProviderNames = new Set(["resend", "sendgrid", "mailgun", "postmark", "smtp"]);

export type RealProviderBlockedReason =
  | "real_provider_missing"
  | "real_provider_incomplete"
  | "real_provider_invalid_format"
  | "real_delivery_enable_flag_missing"
  | "webhook_signature_required"
  | "real_sent_transition_deferred";

export type RealProviderReadinessRecord = {
  provider_mode: "sandbox_only" | "real_configured_disabled" | "real_configured_invalid";
  real_provider_configured: boolean;
  real_provider_name_configured: boolean;
  real_provider_secret_configured: boolean;
  real_provider_config_valid: boolean;
  real_provider_adapter_available: boolean;
  real_provider_adapter: typeof realProviderAdapter;
  real_provider_config_version: typeof realProviderConfigVersion;
  real_provider_adapter_version: typeof realProviderAdapterVersion;
  explicit_real_delivery_enable_required: true;
  real_delivery_enable_requested: boolean;
  real_delivery_enabled: false;
  webhook_configured: boolean;
  webhook_enable_requested: boolean;
  webhook_signature_verification_ready: boolean;
  webhook_consumption_enabled: false;
  real_provider_acknowledgement_enabled: false;
  real_provider_acknowledgement_verified: false;
  real_sent_transition_enabled: false;
  provider_secret_returned: false;
  provider_raw_payload_returned: false;
  webhook_secret_returned: false;
  webhook_signature_returned: false;
  provider_message_id_available: false;
  blocked_reason: RealProviderBlockedReason;
  deferred_actions: string[];
};

export type DeliveryProviderAdapter = {
  provider_adapter: typeof realProviderAdapter;
  adapter_version: typeof realProviderAdapterVersion;
  provider_config_version: typeof realProviderConfigVersion;
  mode: "real_provider_disabled";
  real_delivery_enabled: false;
  send: () => Promise<never>;
};

function configured(keys: readonly string[]): boolean {
  return keys.some((key) => Boolean(process.env[key]?.trim()));
}

function firstConfiguredValue(keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }
  return null;
}

function envFlagEnabled(key: string): boolean {
  const value = process.env[key]?.trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes";
}

function providerNameIsValid(): boolean {
  const providerName = firstConfiguredValue(providerNameKeys);
  return providerName === null || supportedProviderNames.has(providerName.toLowerCase());
}

export function getRealProviderReadiness(): RealProviderReadinessRecord {
  const realProviderConfigured = configured(providerSignalKeys);
  const providerNameConfigured = configured(providerNameKeys);
  const providerSecretConfigured = configured(providerSecretKeys);
  const providerConfigValid = Boolean(
    realProviderConfigured &&
    providerNameConfigured &&
    providerSecretConfigured &&
    providerNameIsValid()
  );
  const deliveryEnableRequested = envFlagEnabled("QUOTE_REAL_PROVIDER_DELIVERY_ENABLED");
  const webhookSecretConfigured = configured(webhookSecretKeys);
  const webhookEnableRequested = envFlagEnabled("QUOTE_PROVIDER_WEBHOOKS_ENABLED");
  const webhookSignatureVerificationReady = Boolean(providerConfigValid && webhookSecretConfigured);
  const providerMode: RealProviderReadinessRecord["provider_mode"] = !realProviderConfigured
    ? "sandbox_only"
    : providerConfigValid
      ? "real_configured_disabled"
      : "real_configured_invalid";
  const blockedReason: RealProviderBlockedReason = !realProviderConfigured
    ? "real_provider_missing"
    : !providerNameIsValid()
      ? "real_provider_invalid_format"
      : !providerConfigValid
        ? "real_provider_incomplete"
        : !deliveryEnableRequested
          ? "real_delivery_enable_flag_missing"
          : !webhookSignatureVerificationReady
            ? "webhook_signature_required"
            : "real_sent_transition_deferred";

  return {
    provider_mode: providerMode,
    real_provider_configured: realProviderConfigured,
    real_provider_name_configured: providerNameConfigured,
    real_provider_secret_configured: providerSecretConfigured,
    real_provider_config_valid: providerConfigValid,
    real_provider_adapter_available: true,
    real_provider_adapter: realProviderAdapter,
    real_provider_config_version: realProviderConfigVersion,
    real_provider_adapter_version: realProviderAdapterVersion,
    explicit_real_delivery_enable_required: true,
    real_delivery_enable_requested: deliveryEnableRequested,
    real_delivery_enabled: false,
    webhook_configured: webhookSecretConfigured,
    webhook_enable_requested: webhookEnableRequested,
    webhook_signature_verification_ready: webhookSignatureVerificationReady,
    webhook_consumption_enabled: false,
    real_provider_acknowledgement_enabled: false,
    real_provider_acknowledgement_verified: false,
    real_sent_transition_enabled: false,
    provider_secret_returned: false,
    provider_raw_payload_returned: false,
    webhook_secret_returned: false,
    webhook_signature_returned: false,
    provider_message_id_available: false,
    blocked_reason: blockedReason,
    deferred_actions: [
      "real_provider_delivery",
      "real_provider_webhook_consumption",
      "real_provider_acknowledgement",
      "quote_sent_transition",
      "production_package"
    ]
  };
}

export function getRealProviderAdapter(): DeliveryProviderAdapter {
  return {
    provider_adapter: realProviderAdapter,
    adapter_version: realProviderAdapterVersion,
    provider_config_version: realProviderConfigVersion,
    mode: "real_provider_disabled",
    real_delivery_enabled: false,
    send: async () => {
      throw new Error("real provider delivery is disabled by the P14 safety boundary.");
    }
  };
}
