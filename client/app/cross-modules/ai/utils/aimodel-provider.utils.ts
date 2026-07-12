import { IProvider } from "@blocks-ai/types/aimodel.service.type";

/**
 * The kind of platform that hosts an AI model integration. Drives how
 * credentials and request URLs are configured in the AI settings UI.
 */
export enum ServicePlatform {
  /** A first-party, officially hosted API such as OpenAI or Anthropic. */
  OFFICIAL_API = "official_api",
  /** A self-hostable open-weights deployment such as Azure AI or OpenRouter. */
  OPEN_DEPLOYMENT = "open_deployment",
  /** A user-defined custom deployment pointing at an arbitrary HTTP endpoint. */
  CUSTOM_DEPLOYMENT = "custom_deployment",
}

export const createCustomProvider = (): IProvider => ({
  Provider: "CUSTOM",
  Url: "",
  DocLink: "",
  Description:
    "Bring your own AI model to the platform by connecting external APIs for full customization and control.",
  Order: 999999,
});

/**
 * Coarse-grained grouping of an AI provider used in UI filters.
 */
export enum ProviderType {
  /** A first-party, officially hosted provider (OpenAI, Anthropic, ...). */
  OFFICIAL = "official",
  /** An open-weights provider (Azure, OpenRouter, ...). */
  OPEN = "open",
  /** A user-defined custom provider. */
  CUSTOM = "custom",
}

export const ProviderToPlatformMap: Record<string, ServicePlatform> = {
  openai: ServicePlatform.OFFICIAL_API,
  anthropic: ServicePlatform.OFFICIAL_API,
  google: ServicePlatform.OFFICIAL_API,
  mistral: ServicePlatform.OFFICIAL_API,
  deepseek: ServicePlatform.OFFICIAL_API,

  azure: ServicePlatform.OPEN_DEPLOYMENT,
  openrouter: ServicePlatform.OPEN_DEPLOYMENT,

  custom: ServicePlatform.OPEN_DEPLOYMENT,
};

export const ProviderNameMap: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Gemini",
  mistral: "Mistral",
  deepseek: "DeepSeek",
  azure: "Azure",
  openrouter: "OpenRouter",
  custom: "Custom Model",
};

export const getProviderDisplayName = (provider: string | undefined): string => {
  if (!provider) return "Provider";
  const mapped = ProviderNameMap[provider.toLowerCase()];
  if (mapped) return mapped;
  return provider.charAt(0).toUpperCase() + provider.slice(1);
};
