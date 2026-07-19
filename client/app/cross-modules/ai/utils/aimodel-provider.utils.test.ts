import { describe, expect, it } from "vitest";
import {
  ServicePlatform,
  ProviderType,
  ProviderToPlatformMap,
  ProviderNameMap,
  createCustomProvider,
  getProviderDisplayName,
} from "./aimodel-provider.utils";

describe("aimodel-provider.utils", () => {
  describe("createCustomProvider", () => {
    it("creates a CUSTOM provider with a high order and empty urls", () => {
      const provider = createCustomProvider();
      expect(provider.Provider).toBe("CUSTOM");
      expect(provider.Url).toBe("");
      expect(provider.Order).toBe(999999);
      expect(provider.Description).toContain("Bring your own AI model");
    });
  });

  describe("ProviderToPlatformMap", () => {
    it("maps official APIs and open deployments", () => {
      expect(ProviderToPlatformMap.openai).toBe(ServicePlatform.OFFICIAL_API);
      expect(ProviderToPlatformMap.azure).toBe(ServicePlatform.OPEN_DEPLOYMENT);
      expect(ProviderToPlatformMap.custom).toBe(ServicePlatform.OPEN_DEPLOYMENT);
    });
  });

  describe("getProviderDisplayName", () => {
    it("returns the friendly name for a known provider", () => {
      expect(getProviderDisplayName("openai")).toBe("OpenAI");
      expect(getProviderDisplayName("google")).toBe(ProviderNameMap.google);
    });
    it("is case-insensitive", () => {
      expect(getProviderDisplayName("ANTHROPIC")).toBe("Anthropic");
    });
    it("capitalizes an unknown provider", () => {
      expect(getProviderDisplayName("acme")).toBe("Acme");
    });
    it("falls back to 'Provider' when empty", () => {
      expect(getProviderDisplayName(undefined)).toBe("Provider");
      expect(getProviderDisplayName("")).toBe("Provider");
    });
  });

  it("exposes the ProviderType enum values", () => {
    expect(ProviderType.OFFICIAL).toBe("official");
    expect(ProviderType.OPEN).toBe("open");
    expect(ProviderType.CUSTOM).toBe("custom");
  });
});
