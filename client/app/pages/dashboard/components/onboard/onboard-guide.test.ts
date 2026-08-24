import { describe, expect, it } from "vitest";
import {
  maskValue,
  resolveOnboardingGuide,
  revealKey,
  toHost,
} from "./onboard-guide";

const domain = {
  domain: "https://stg-a1b2c.seliseblocks.com",
  cookieDomain: "seliseblocks.com",
  isDomainVerified: true,
};

describe("resolveOnboardingGuide", () => {
  it("leaves no placeholder behind when the project is fully configured", () => {
    const { markdown } = resolveOnboardingGuide({ tenantId: "tenant-key-123", domain });
    expect(markdown).not.toMatch(/\{\{\w+\}\}/);
  });

  it("resolves every value from the project and its domain", () => {
    const { values, missing } = resolveOnboardingGuide({ tenantId: "tenant-key-123", domain });
    expect(values).toEqual({
      X_BLOCKS_KEY: "tenant-key-123",
      APP_DOMAIN: "https://stg-a1b2c.seliseblocks.com",
      APP_HOST: "stg-a1b2c.seliseblocks.com",
      BLOCKS_API_URL: "https://blocksapi.seliseblocks.com",
    });
    expect(missing).toEqual([]);
  });

  it("substitutes the key into the brief", () => {
    const { markdown } = resolveOnboardingGuide({ tenantId: "tenant-key-123", domain });
    expect(markdown).toContain("project tenant-key-123");
    expect(markdown).toContain(
      "https://raw.githubusercontent.com/SELISEdigitalplatforms/blocks-skills/main/BOOTSTRAP.md",
    );
  });

  it("normalizes a domain stored without a protocol or with a trailing slash", () => {
    const { values } = resolveOnboardingGuide({
      tenantId: "key",
      domain: { ...domain, domain: "a1b2c.seliseblocks.com/" },
    });
    expect(values.APP_DOMAIN).toBe("https://a1b2c.seliseblocks.com");
    expect(values.APP_HOST).toBe("a1b2c.seliseblocks.com");
  });

  it("falls back to the last two labels of the host when no cookie domain is stored", () => {
    const { values } = resolveOnboardingGuide({
      tenantId: "key",
      domain: { ...domain, domain: "https://dqrsf.slsblx.com", cookieDomain: "" },
    });
    expect(values.BLOCKS_API_URL).toBe("https://blocksapi.slsblx.com");
  });

  it("reports what is missing when no domain exists", () => {
    const { values, missing } = resolveOnboardingGuide({
      tenantId: "tenant-key-123",
      domain: null,
    });
    expect(missing).toEqual(["APP_DOMAIN", "APP_HOST", "BLOCKS_API_URL"]);
    expect(values.X_BLOCKS_KEY).toBe("tenant-key-123");
  });

  it("masks the key in the markdown only, never in the returned values", () => {
    const { markdown, values } = resolveOnboardingGuide({
      tenantId: "tenant-key-123",
      domain,
      maskKey: true,
    });
    expect(values.X_BLOCKS_KEY).toBe("tenant-key-123");
    expect(markdown).not.toContain("tenant-key-123");
    expect(markdown).toContain(maskValue("tenant-key-123"));
  });
});

describe("revealKey", () => {
  it("swaps every masked occurrence back for the real key", () => {
    const masked = maskValue("tenant-key-123");
    expect(revealKey(`blocks use ${masked}`, masked, "tenant-key-123")).toBe(
      "blocks use tenant-key-123",
    );
  });

  it("leaves text untouched when there is nothing to reveal", () => {
    expect(revealKey("blocks login", "", "tenant-key-123")).toBe("blocks login");
  });
});

describe("maskValue", () => {
  it("keeps the first and last three characters visible", () => {
    expect(maskValue("abcdefghijklmnop")).toBe(`abc${"*".repeat(14)}nop`);
  });

  it("returns an empty string for an empty value", () => {
    expect(maskValue("")).toBe("");
  });
});

describe("toHost", () => {
  it("strips the protocol and trailing slashes", () => {
    expect(toHost(" https://example.com/ ")).toBe("example.com");
    expect(toHost("http://example.com")).toBe("example.com");
    expect(toHost("example.com")).toBe("example.com");
  });
});
