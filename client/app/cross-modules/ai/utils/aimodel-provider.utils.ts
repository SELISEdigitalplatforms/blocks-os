import { IProvider } from "@blocks-ai/types/aimodel.service.type";
import { tStatic } from "@seliseblocks/genesis-os";

const I18N_MODULE = "os.ai";

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
  Description: tStatic(I18N_MODULE, "AIMODEL_PROVIDER_UTILS.BRING_YOUR_OWN_AI_MODEL"),
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
  get google() {
    return tStatic(I18N_MODULE, "AIMODEL_PROVIDER_UTILS.GEMINI");
  },
  get mistral() {
    return tStatic(I18N_MODULE, "AIMODEL_PROVIDER_UTILS.MISTRAL");
  },
  deepseek: "DeepSeek",
  azure: "Azure",
  openrouter: "OpenRouter",
  get custom() {
    return tStatic(I18N_MODULE, "AIMODEL_PROVIDER_UTILS.CUSTOM_MODEL");
  },
};

export const getProviderDisplayName = (provider: string | undefined): string => {
  if (!provider) return tStatic(I18N_MODULE, "AIMODEL_PROVIDER_UTILS.PROVIDER");
  const mapped = ProviderNameMap[provider.toLowerCase()];
  if (mapped) return mapped;
  return provider.charAt(0).toUpperCase() + provider.slice(1);
};
